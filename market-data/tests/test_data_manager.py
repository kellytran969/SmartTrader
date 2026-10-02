import pytest

from app.data_manager import DataManager
from app.models import HoldingInput, ValuationRequest
from app.providers import SimulatedProvider


def make_dm(**kwargs):
    defaults = dict(
        provider=SimulatedProvider(seed=1234),
        quote_ttl_l1=60,
        quote_ttl_l2=300,
        rate_per_sec=1000,
        burst=100,
    )
    defaults.update(kwargs)
    return DataManager(**defaults)


async def test_get_quotes_returns_requested_symbols():
    dm = make_dm()
    quotes = await dm.get_quotes(["AAPL", "MSFT"])
    assert [q.symbol for q in quotes] == ["AAPL", "MSFT"]
    assert all(q.price > 0 for q in quotes)
    assert all(q.provider == "simulated" for q in quotes)


async def test_unknown_symbol_rejected():
    dm = make_dm()
    with pytest.raises(ValueError):
        await dm.get_quotes(["NOPE"])


async def test_second_fetch_served_from_cache_no_provider_call():
    dm = make_dm()
    await dm.get_quotes(["AAPL"])
    assert dm.provider_calls == 1
    await dm.get_quotes(["AAPL"])
    assert dm.provider_calls == 1  # no new provider call
    assert dm.cache_served >= 1


async def test_cache_expiry_triggers_provider_call():
    dm = make_dm(quote_ttl_l1=0.01, quote_ttl_l2=0.01)
    await dm.get_quotes(["AAPL"])
    assert dm.provider_calls == 1
    import asyncio

    await asyncio.sleep(0.05)
    await dm.get_quotes(["AAPL"])
    assert dm.provider_calls == 2


async def test_valuate_computes_pnl():
    dm = make_dm()
    quotes = await dm.get_quotes(["AAPL"])
    price = quotes[0].price
    req = ValuationRequest(
        holdings=[HoldingInput(symbol="AAPL", qty=10, avg_cost=price - 10)]
    )
    res = await dm.valuate(req)
    assert len(res.positions) == 1
    pos = res.positions[0]
    assert pos.market_value == round(10 * price, 2)
    assert pos.unrealized_pnl == round(10 * price - 10 * (price - 10), 2)
    assert res.total_market_value == pos.market_value


async def test_valuate_empty_holdings():
    dm = make_dm()
    res = await dm.valuate(ValuationRequest(holdings=[]))
    assert res.positions == []
    assert res.total_market_value == 0.0


async def test_history_returns_points():
    dm = make_dm()
    hist = await dm.get_history("AAPL", points=10)
    assert len(hist) == 10
    assert all(h["price"] > 0 for h in hist)
    assert hist[-1]["t"] > hist[0]["t"]


def test_stats_shape():
    dm = make_dm()
    s = dm.stats()
    assert s["provider"] == "simulated"
    assert "cache" in s and "rate_limiter" in s
    assert s["cache"]["l1"]["hits"] == 0
