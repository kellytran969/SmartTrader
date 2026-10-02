"""Centralized Data Manager.

All market data flows through here. It composes:
  * a token-bucket rate limiter guarding outbound provider calls, and
  * a multi-level cache (in-memory LRU L1, optional Redis L2)

so repeated quote requests are served from cache and third-party APIs are
only hit when necessary. This is the component behind the resume bullet:
rate limiting + multi-level caching cutting provider calls and latency.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

from .cache import LRUCache, MultiLevelCache, RedisCache
from .config import settings
from .instruments import BASE_PRICES, INSTRUMENTS, SYMBOLS
from .models import Quote, ValuedPosition, ValuationRequest, ValuationResponse
from .providers import PriceProvider, SimulatedProvider, build_provider
from .rate_limiter import TokenBucket


class DataManager:
    def __init__(
        self,
        provider: Optional[PriceProvider] = None,
        redis_url: str = "",
        quote_ttl_l1: float = 5.0,
        quote_ttl_l2: float = 30.0,
        rate_per_sec: float = 10.0,
        burst: int = 20,
    ) -> None:
        self.provider = provider or build_provider()
        self.limiter = TokenBucket(rate_per_sec=rate_per_sec, capacity=burst)
        l2: Optional[RedisCache] = None
        if redis_url:
            try:
                l2 = RedisCache(redis_url)
            except Exception:
                l2 = None  # Redis unavailable -> L1-only, still fully functional
        self.cache = MultiLevelCache(
            LRUCache(maxsize=2048), l2, ttl_l1=quote_ttl_l1, ttl_l2=quote_ttl_l2
        )
        self._lock = asyncio.Lock()
        self.provider_calls = 0
        self.cache_served = 0

    async def close(self) -> None:
        l2 = self.cache._l2
        if l2 is not None:
            await l2.close()

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        """Cache-aside quote fetch. Unknown symbols raise ValueError."""
        unknown = [s for s in symbols if s not in SYMBOLS]
        if unknown:
            raise ValueError(f"unknown symbols: {', '.join(unknown)}")
        # Preserve request order, de-duplicate.
        ordered = list(dict.fromkeys(symbols))
        results: dict[str, Quote] = {}
        missing: list[str] = []
        for symbol in ordered:
            cached = await self.cache.get(f"quote:{symbol}")
            if cached is not None:
                self.cache_served += 1
                results[symbol] = Quote(**cached)
            else:
                missing.append(symbol)
        if missing:
            # Rate-limit the outbound provider call, then fan out.
            await self.limiter.acquire()
            async with self._lock:  # single-flight: one provider call per batch
                # Re-check cache under the lock (another batch may have filled it).
                still_missing = []
                for symbol in missing:
                    cached = await self.cache.get(f"quote:{symbol}")
                    if cached is not None:
                        self.cache_served += 1
                        results[symbol] = Quote(**cached)
                    else:
                        still_missing.append(symbol)
                if still_missing:
                    prices = await self.provider.fetch_quotes(still_missing)
                    self.provider_calls += 1
                    ts = int(time.time())
                    for symbol, price in prices.items():
                        quote = Quote(
                            symbol=symbol,
                            price=price,
                            ts=ts,
                            provider=self.provider.name,
                        )
                        results[symbol] = quote
                        await self.cache.set(
                            f"quote:{symbol}", quote.model_dump()
                        )
        return [results[s] for s in ordered]

    async def get_history(self, symbol: str, points: int = 60) -> list[dict]:
        if symbol not in SYMBOLS:
            raise ValueError(f"unknown symbol: {symbol}")
        provider = self.provider
        if isinstance(provider, SimulatedProvider):
            return provider.history(symbol, points)
        # For live providers, synthesize a short history from the latest quote
        # (a real deployment would query a candles endpoint here).
        quotes = await self.get_quotes([symbol])
        now = int(time.time())
        return [
            {"t": now - (points - 1 - i) * 60, "price": quotes[0].price}
            for i in range(points)
        ]

    async def valuate(self, req: ValuationRequest) -> ValuationResponse:
        symbols = [h.symbol for h in req.holdings]
        quotes = (
            await self.get_quotes(symbols) if symbols else []
        )
        by_symbol = {q.symbol: q.price for q in quotes}
        positions: list[ValuedPosition] = []
        total_value = 0.0
        total_cost = 0.0
        for h in req.holdings:
            price = by_symbol[h.symbol]
            market_value = round(h.qty * price, 2)
            cost = round(h.qty * h.avg_cost, 2)
            pnl = round(market_value - cost, 2)
            positions.append(
                ValuedPosition(
                    symbol=h.symbol,
                    qty=h.qty,
                    avg_cost=h.avg_cost,
                    price=price,
                    market_value=market_value,
                    unrealized_pnl=pnl,
                    unrealized_pnl_pct=round(pnl / cost * 100, 2) if cost else 0.0,
                )
            )
            total_value += market_value
            total_cost += cost
        return ValuationResponse(
            positions=positions,
            total_market_value=round(total_value, 2),
            total_cost=round(total_cost, 2),
            total_unrealized_pnl=round(total_value - total_cost, 2),
            ts=int(time.time()),
        )

    def stats(self) -> dict:
        return {
            "provider": self.provider.name,
            "provider_calls": self.provider_calls,
            "cache_served": self.cache_served,
            "cache": self.cache.stats(),
            "rate_limiter": self.limiter.snapshot(),
        }

    @staticmethod
    def instruments() -> list[dict]:
        return INSTRUMENTS

    @staticmethod
    def base_price(symbol: str) -> float:
        return BASE_PRICES[symbol]
