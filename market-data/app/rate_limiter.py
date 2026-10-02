"""Async token-bucket rate limiter for outbound price-provider calls."""

from __future__ import annotations

import asyncio
import time


class TokenBucket:
    """A classic token bucket.

    `capacity` is the max burst size; tokens refill at `rate_per_sec`.
    `acquire()` blocks until at least one token is available, then consumes
    it. Thread/async safe via an asyncio lock.
    """

    def __init__(self, rate_per_sec: float, capacity: int) -> None:
        if rate_per_sec <= 0:
            raise ValueError("rate_per_sec must be positive")
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self._rate = rate_per_sec
        self._capacity = float(capacity)
        self._tokens = float(capacity)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()
        self.total_acquired = 0
        self.total_waited_sec = 0.0

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        if elapsed > 0:
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
            self._last_refill = now

    @property
    def available(self) -> float:
        self._refill()
        return self._tokens

    async def acquire(self, tokens: int = 1) -> float:
        """Wait until `tokens` are available, consume them, return wait time."""
        if tokens > self._capacity:
            raise ValueError("cannot acquire more tokens than capacity")
        waited = 0.0
        while True:
            async with self._lock:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    self.total_acquired += tokens
                    self.total_waited_sec += waited
                    return waited
                # Not enough tokens: compute how long until there are.
                deficit = tokens - self._tokens
                sleep_for = deficit / self._rate
            await asyncio.sleep(sleep_for)
            waited += sleep_for

    def snapshot(self) -> dict:
        self._refill()
        return {
            "rate_per_sec": self._rate,
            "capacity": int(self._capacity),
            "available": round(self._tokens, 3),
            "total_acquired": self.total_acquired,
            "total_waited_sec": round(self.total_waited_sec, 3),
        }
