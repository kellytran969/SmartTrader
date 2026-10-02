"""Multi-level cache: in-memory LRU (L1) backed by optional Redis (L2)."""

from __future__ import annotations

import json
import time
from collections import OrderedDict
from typing import Any, Optional

try:  # Redis is optional; the service runs fully without it.
    import redis.asyncio as aioredis

    _REDIS_AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False


class LRUCache:
    """Thread-agnostic in-memory LRU with per-entry TTL."""

    def __init__(self, maxsize: int = 1024) -> None:
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._maxsize = maxsize
        self.hits = 0
        self.misses = 0

    def _evict_expired(self, key: str, expires_at: float, now: float) -> bool:
        if expires_at <= now:
            del self._store[key]
            return True
        return False

    def get(self, key: str) -> Optional[Any]:
        now = time.monotonic()
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        expires_at, value = entry
        if self._evict_expired(key, expires_at, now):
            self.misses += 1
            return None
        self._store.move_to_end(key)
        self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl: float) -> None:
        if key in self._store:
            del self._store[key]
        while len(self._store) >= self._maxsize:
            self._store.popitem(last=False)
        self._store[key] = (time.monotonic() + ttl, value)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 4) if total else 0.0,
            "size": len(self._store),
            "maxsize": self._maxsize,
        }


class RedisCache:
    """Async Redis tier. Raises on construction failure so callers can
    fall back to L1-only operation."""

    def __init__(self, url: str) -> None:
        if not _REDIS_AVAILABLE:
            raise RuntimeError("redis package not installed")
        self._client = aioredis.from_url(url, decode_responses=True)
        self.hits = 0
        self.misses = 0

    async def get(self, key: str) -> Optional[Any]:
        raw = await self._client.get(f"smarttrader:{key}")
        if raw is None:
            self.misses += 1
            return None
        self.hits += 1
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    async def set(self, key: str, value: Any, ttl: float) -> None:
        await self._client.set(
            f"smarttrader:{key}", json.dumps(value), ex=max(1, int(ttl))
        )

    async def close(self) -> None:
        await self._client.aclose()

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 4) if total else 0.0,
        }


class MultiLevelCache:
    """Cache-aside across L1 (memory) and optional L2 (Redis).

    Reads check L1 first, then L2 (promoting L2 hits into L1). Writes go to
    both tiers with their respective TTLs.
    """

    def __init__(
        self,
        l1: LRUCache,
        l2: Optional[RedisCache],
        ttl_l1: float,
        ttl_l2: float,
    ) -> None:
        self._l1 = l1
        self._l2 = l2
        self._ttl_l1 = ttl_l1
        self._ttl_l2 = ttl_l2

    async def get(self, key: str) -> Optional[Any]:
        value = self._l1.get(key)
        if value is not None:
            return value
        if self._l2 is not None:
            value = await self._l2.get(key)
            if value is not None:
                # Promote into L1 so the next read is local.
                self._l1.set(key, value, self._ttl_l1)
                return value
        return None

    async def set(self, key: str, value: Any) -> None:
        self._l1.set(key, value, self._ttl_l1)
        if self._l2 is not None:
            await self._l2.set(key, value, self._ttl_l2)

    def stats(self) -> dict:
        return {
            "l1": self._l1.stats(),
            "l2": self._l2.stats() if self._l2 else {"enabled": False},
        }
