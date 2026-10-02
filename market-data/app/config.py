"""Service configuration, driven by environment variables."""

from __future__ import annotations

import os


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class Settings:
    # Price provider: "simulated" (default, zero-setup) or "finnhub" / "alphavantage".
    PRICE_PROVIDER: str = os.environ.get("PRICE_PROVIDER", "simulated").lower()
    FINNHUB_API_KEY: str = os.environ.get("FINNHUB_API_KEY", "")
    ALPHAVANTAGE_API_KEY: str = os.environ.get("ALPHAVANTAGE_API_KEY", "")

    # Optional Redis for the L2 cache tier. When unset, only the in-memory
    # LRU (L1) tier is active and the service still works fully.
    REDIS_URL: str = os.environ.get("REDIS_URL", "")

    # Cache TTLs (seconds).
    QUOTE_TTL_L1: float = _get_float("QUOTE_TTL_L1", 5.0)
    QUOTE_TTL_L2: float = _get_float("QUOTE_TTL_L2", 30.0)
    HISTORY_POINTS: int = _get_int("HISTORY_POINTS", 120)

    # Token-bucket rate limiter for outbound provider calls.
    PROVIDER_RATE_LIMIT_PER_SEC: float = _get_float("PROVIDER_RATE_LIMIT_PER_SEC", 10.0)
    PROVIDER_BURST: int = _get_int("PROVIDER_BURST", 20)

    # WebSocket tick interval (seconds).
    TICK_INTERVAL: float = _get_float("TICK_INTERVAL", 1.0)


settings = Settings()
