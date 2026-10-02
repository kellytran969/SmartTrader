"""Pydantic schemas for the market-data service."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Instrument(BaseModel):
    symbol: str
    name: str
    type: Literal["stock", "etf", "crypto"]
    base_price: float


class Quote(BaseModel):
    symbol: str
    price: float
    ts: int
    provider: str


class HistoryPoint(BaseModel):
    t: int
    price: float


class HoldingInput(BaseModel):
    symbol: str
    qty: float = Field(gt=0)
    avg_cost: float = Field(ge=0)


class ValuationRequest(BaseModel):
    holdings: list[HoldingInput]


class ValuedPosition(BaseModel):
    symbol: str
    qty: float
    avg_cost: float
    price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float


class ValuationResponse(BaseModel):
    positions: list[ValuedPosition]
    total_market_value: float
    total_cost: float
    total_unrealized_pnl: float
    ts: int
