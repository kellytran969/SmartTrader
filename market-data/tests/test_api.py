"""API-level tests using FastAPI's TestClient (ASGI transport)."""

from fastapi.testclient import TestClient

from app.data_manager import DataManager
from app.main import app
from app.providers import SimulatedProvider


def make_client():
    dm = DataManager(
        provider=SimulatedProvider(seed=42),
        quote_ttl_l1=60,
        quote_ttl_l2=300,
        rate_per_sec=1000,
        burst=100,
    )
    app.state.dm = dm
    return TestClient(app)


def test_health():
    client = make_client()
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_instruments_lists_universe():
    client = make_client()
    r = client.get("/api/instruments")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 12
    assert {i["symbol"] for i in body} >= {"AAPL", "BTC", "SPY"}


def test_quotes_endpoint():
    client = make_client()
    r = client.get("/api/quotes", params={"symbols": "AAPL,MSFT"})
    assert r.status_code == 200
    body = r.json()
    assert [q["symbol"] for q in body] == ["AAPL", "MSFT"]
    assert all(q["price"] > 0 for q in body)


def test_quotes_unknown_symbol_400():
    client = make_client()
    r = client.get("/api/quotes", params={"symbols": "NOPE"})
    assert r.status_code == 400


def test_history_endpoint():
    client = make_client()
    r = client.get("/api/history/AAPL", params={"points": 5})
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_valuate_endpoint():
    client = make_client()
    q = client.get("/api/quotes", params={"symbols": "AAPL"}).json()[0]
    r = client.post(
        "/api/valuate",
        json={"holdings": [{"symbol": "AAPL", "qty": 2, "avg_cost": 100.0}]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["positions"][0]["market_value"] == round(2 * q["price"], 2)


def test_stats_endpoint():
    client = make_client()
    client.get("/api/quotes", params={"symbols": "AAPL"})
    r = client.get("/api/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["provider_calls"] == 1
    assert body["cache"]["l1"]["misses"] >= 1


def test_websocket_ticks():
    client = make_client()
    with client.websocket_connect("/ws/ticks?symbols=AAPL") as ws:
        msg = ws.receive_json()
        assert "ticks" in msg
        assert msg["ticks"][0]["symbol"] == "AAPL"
        assert msg["ticks"][0]["price"] > 0
