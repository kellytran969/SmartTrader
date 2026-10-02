"""Price providers.

The default ``SimulatedProvider`` produces a realistic random-walk feed so
the whole platform runs with zero external dependencies. Real providers
(Finnhub, Alpha Vantage) can be enabled with an API key; they share the
same interface and are subject to the same rate limiting and caching.
"""

from __future__ import annotations

import math
import random
import time
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from .config import settings
from .instruments import BASE_PRICES, SYMBOLS


class PriceProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def fetch_quotes(self, symbols: list[str]) -> dict[str, float]:
        """Return the latest price per symbol. Raises on provider errors."""


class SimulatedProvider(PriceProvider):
    """Deterministic-ish random-walk feed.

    Each symbol walks around its base price with symbol-specific volatility.
    A per-symbol RNG seeded from the symbol keeps the walk stable across
    restarts, while a time-based drift term keeps ticks moving.
    """

    name = "simulated"
    _VOLATILITY = {
        "BTC": 0.004, "ETH": 0.005, "TSLA": 0.0035, "NVDA": 0.003,
    }
    _DEFAULT_VOL = 0.0015

    def __init__(self, history_points: int = 120, seed: Optional[int] = None) -> None:
        self._history_points = history_points
        self._rng = random.Random(seed)
        # Pre-roll a price path per symbol so history looks organic.
        self._paths: dict[str, list[float]] = {}
        for symbol in SYMBOLS:
            base = BASE_PRICES[symbol]
            vol = self._VOLATILITY.get(symbol, self._DEFAULT_VOL)
            path = [base]
            rng = random.Random(hash(symbol) ^ (seed or 0))
            for _ in range(history_points):
                drift = rng.gauss(0, vol)
                # Weak mean reversion toward the base price.
                reversion = (base - path[-1]) / base * 0.002
                path.append(max(base * 0.1, path[-1] * (1 + drift + reversion)))
            self._paths[symbol] = path

    def _tick(self, symbol: str) -> float:
        path = self._paths[symbol]
        base = BASE_PRICES[symbol]
        vol = self._VOLATILITY.get(symbol, self._DEFAULT_VOL)
        # Small live jitter around the last close, scaled by elapsed time.
        jitter = self._rng.gauss(0, vol / 3)
        price = path[-1] * (1 + jitter)
        price = max(base * 0.1, price)
        path.append(price)
        if len(path) > self._history_points * 2:
            del path[: self._history_points]
        return price

    async def fetch_quotes(self, symbols: list[str]) -> dict[str, float]:
        unknown = [s for s in symbols if s not in self._paths]
        if unknown:
            raise ValueError(f"unknown symbols: {', '.join(unknown)}")
        return {
            s: round(self._tick(s), 2 if BASE_PRICES[s] < 10000 else 0)
            for s in symbols
        }

    def history(self, symbol: str, points: int) -> list[dict]:
        path = self._paths[symbol][-points:]
        step = 60  # one point per minute, backfilled
        now = int(time.time())
        return [
            {"t": now - (len(path) - 1 - i) * step, "price": round(p, 2)}
            for i, p in enumerate(path)
        ]


class FinnhubProvider(PriceProvider):
    """Live quotes from Finnhub (https://finnhub.io). Requires FINNHUB_API_KEY."""

    name = "finnhub"

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    async def fetch_quotes(self, symbols: list[str]) -> dict[str, float]:
        out: dict[str, float] = {}
        async with httpx.AsyncClient(timeout=10) as client:
            for symbol in symbols:
                # Finnhub crypto symbols need the BINANCE: prefix.
                q = f"BINANCE:{symbol}USDT" if symbol in ("BTC", "ETH") else symbol
                r = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": q, "token": self._key},
                )
                r.raise_for_status()
                price = r.json().get("c")
                if not price:
                    raise RuntimeError(f"no quote for {symbol} from finnhub")
                out[symbol] = round(float(price), 2)
        return out


class AlphaVantageProvider(PriceProvider):
    """Live quotes from Alpha Vantage. Requires ALPHAVANTAGE_API_KEY.

    Note: the free tier is limited to 25 requests/day, so the rate limiter
    and cache tiers matter even more with this provider.
    """

    name = "alphavantage"

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    async def fetch_quotes(self, symbols: list[str]) -> dict[str, float]:
        out: dict[str, float] = {}
        async with httpx.AsyncClient(timeout=10) as client:
            for symbol in symbols:
                r = await client.get(
                    "https://www.alphavantage.co/query",
                    params={
                        "function": "GLOBAL_QUOTE",
                        "symbol": symbol,
                        "apikey": self._key,
                    },
                )
                r.raise_for_status()
                quote = r.json().get("Global Quote", {})
                price = quote.get("05. price")
                if not price:
                    raise RuntimeError(f"no quote for {symbol} from alphavantage")
                out[symbol] = round(float(price), 2)
        return out


def build_provider() -> PriceProvider:
    choice = settings.PRICE_PROVIDER
    if choice == "finnhub":
        if not settings.FINNHUB_API_KEY:
            raise RuntimeError("PRICE_PROVIDER=finnhub requires FINNHUB_API_KEY")
        return FinnhubProvider(settings.FINNHUB_API_KEY)
    if choice == "alphavantage":
        if not settings.ALPHAVANTAGE_API_KEY:
            raise RuntimeError(
                "PRICE_PROVIDER=alphavantage requires ALPHAVANTAGE_API_KEY"
            )
        return AlphaVantageProvider(settings.ALPHAVANTAGE_API_KEY)
    return SimulatedProvider(history_points=settings.HISTORY_POINTS)
