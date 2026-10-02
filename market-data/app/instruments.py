"""The tradable instrument universe with reference base prices."""

from __future__ import annotations

INSTRUMENTS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "base_price": 232.50},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "type": "stock", "base_price": 428.10},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "type": "stock", "base_price": 138.25},
    {"symbol": "TSLA", "name": "Tesla Inc.", "type": "stock", "base_price": 248.70},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "type": "stock", "base_price": 197.30},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "type": "stock", "base_price": 176.40},
    {"symbol": "META", "name": "Meta Platforms Inc.", "type": "stock", "base_price": 585.20},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF", "type": "etf", "base_price": 598.60},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "type": "etf", "base_price": 521.90},
    {"symbol": "GLD", "name": "SPDR Gold Shares", "type": "etf", "base_price": 244.15},
    {"symbol": "BTC", "name": "Bitcoin", "type": "crypto", "base_price": 97250.00},
    {"symbol": "ETH", "name": "Ethereum", "type": "crypto", "base_price": 3410.00},
]

SYMBOLS = [i["symbol"] for i in INSTRUMENTS]
BASE_PRICES = {i["symbol"]: i["base_price"] for i in INSTRUMENTS}
