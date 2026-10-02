"""SmartTrader market-data service.

Centralized Data Manager (rate limiting + multi-level caching) exposed over
REST, plus a WebSocket endpoint streaming live price ticks.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .data_manager import DataManager
from .instruments import SYMBOLS
from .models import HistoryPoint, Instrument, Quote, ValuationRequest, ValuationResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.dm = DataManager(
        redis_url=settings.REDIS_URL,
        quote_ttl_l1=settings.QUOTE_TTL_L1,
        quote_ttl_l2=settings.QUOTE_TTL_L2,
        rate_per_sec=settings.PROVIDER_RATE_LIMIT_PER_SEC,
        burst=settings.PROVIDER_BURST,
    )
    yield
    await app.state.dm.close()


app = FastAPI(title="SmartTrader Market Data", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def dm() -> DataManager:
    return app.state.dm


@app.get("/health")
def health():
    return {"status": "ok", "provider": dm().provider.name, "ts": int(time.time())}


@app.get("/api/instruments", response_model=list[Instrument])
def instruments():
    return DataManager.instruments()


@app.get("/api/quotes", response_model=list[Quote])
async def quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        return []
    try:
        return await dm().get_quotes(syms)
    except ValueError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/history/{symbol}", response_model=list[HistoryPoint])
async def history(symbol: str, points: int = Query(60, ge=1, le=500)):
    try:
        return await dm().get_history(symbol.upper(), points)
    except ValueError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/valuate", response_model=ValuationResponse)
async def valuate(req: ValuationRequest):
    try:
        return await dm().valuate(req)
    except ValueError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/stats")
def stats():
    """Data Manager internals: cache hit rates, provider calls, limiter state."""
    return dm().stats()


@app.websocket("/ws/ticks")
async def ticks(ws: WebSocket):
    """Stream live price ticks: /ws/ticks?symbols=AAPL,MSFT every TICK_INTERVAL."""
    await ws.accept()
    raw = ws.query_params.get("symbols", "")
    symbols = [s.strip().upper() for s in raw.split(",") if s.strip()] or SYMBOLS[:6]
    symbols = [s for s in symbols if s in SYMBOLS]
    manager = dm()
    try:
        while True:
            quotes = await manager.get_quotes(symbols)
            await ws.send_json(
                {
                    "ts": int(time.time()),
                    "ticks": [q.model_dump() for q in quotes],
                }
            )
            await asyncio.sleep(settings.TICK_INTERVAL)
    except WebSocketDisconnect:
        pass
