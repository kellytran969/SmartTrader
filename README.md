# SmartTrader

A full-stack paper-trading platform: a **Python/FastAPI market-data engine**
with a centralized Data Manager (token-bucket rate limiting + multi-level
caching) and live price streaming, an **Express/Node API** (JWT auth,
portfolios, trade execution, Stripe funding), and a **React dashboard** with
real-time portfolio tracking

```
┌─────────────┐      REST / WS       ┌──────────────────────┐
│   React     │ ◄──────────────────► │  market-data (Py)    │
│  dashboard  │   live price ticks   │  FastAPI :8000       │
│  :5173      │                      │  ┌────────────────┐  │
└──────┬──────┘                      │  │ Data Manager   │  │
       │ REST                       │  │ rate limiter   │  │
       ▼                            │  │ L1 LRU + L2    │  │
┌─────────────┐    HTTP :8000        │  │ Redis cache    │  │
│  Express    │ ◄──────────────────► │  └───────┬────────┘  │
│  API :5000  │   quotes/valuation   │   provider (sim/      │
└──────┬──────┘                      │   Finnhub/AlphaV)     │
       │                            └──────────────────────┘
       ├── MongoDB (users, holdings, transactions)
       └── Stripe (account funding via PaymentIntents)
```

## Features

- **Market-data service (Python/FastAPI)**
  - Centralized Data Manager: every quote flows through cache-aside
    (in-memory LRU L1, optional Redis L2 with L2→L1 promotion) and a
    token-bucket rate limiter guards outbound provider calls.
  - Pluggable price providers: realistic simulated random-walk feed by
    default (zero setup); Finnhub or Alpha Vantage via API key.
  - `WebSocket /ws/ticks` streams live price ticks to the dashboard.
  - Portfolio valuation endpoint; `/api/stats` exposes cache hit rates,
    provider call counts, and limiter state.
- **API (Express/Node)**
  - JWT auth (register/login/me), per-user portfolios with cash balances.
  - Trade execution: buy/sell at live market prices with cash/holdings
    checks and weighted-average cost basis; full transaction ledger.
  - Stripe funding: create a PaymentIntent, confirm it, and the deposit is
    credited **idempotently** (double-confirm never double-credits).
    Runs in **stub mode** with no Stripe keys so the whole flow demos
    locally; uses real Stripe test mode when keys are provided.
  - Watchlist CRUD, market-data proxy routes, zod validation, rate
    limiting, helmet.
- **Dashboard (React/Vite)**
  - Live portfolio tracking: equity/cash/P&L cards update from the tick
    stream (auto-reconnect), allocation donut, positions table with
    per-symbol sparklines — all hand-rolled SVG, no charting library.
  - Trade ticket with instrument search, live price, and estimated total;
    watchlist; filterable transaction history; Stripe Elements funding page.

## Quickstart (zero-setup, no Docker)

You need Node 20+, Python 3.12+, and MongoDB running locally
(or use `docker compose up` instead — see below).

```bash
# 1. market-data (:8000)
cd market-data && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# 2. api (:5000) — new terminal
cd api && npm install
npm run seed        # demo@smarttrader.dev / demo1234 with a starter portfolio
npm run dev

# 3. client (:5173) — new terminal
cd client && npm install && npm run dev
```

Open http://localhost:5173 and log in with the demo account
(`demo@smarttrader.dev` / `demo1234`).

### Docker Compose

```bash
cp .env.example .env   # fill in JWT_SECRET / Stripe keys as needed
docker compose up --build
```

Services: market-data :8000, api :5000, client :8080, plus Redis and
MongoDB. Seed the demo account with
`docker compose exec api node src/seed.js`.

## Stripe test mode

1. Create a free Stripe account and grab the **test** keys from the
   dashboard (Developers → API keys).
2. Put them in `.env` as `STRIPE_SECRET_KEY=sk_test_...` and
   `STRIPE_PUBLISHABLE_KEY=pk_test_...`, restart the API.
3. On the Funding page, pay with test card `4242 4242 4242 4242`
   (any future expiry, any CVC).

Without keys the API runs in **stub mode**: the funding flow works end to
end locally (intent → confirm → balance credited) without touching
Stripe's network. This is clearly labeled in the UI.

## Environment variables

| Variable | Service | Default | Notes |
|---|---|---|---|
| `PRICE_PROVIDER` | market-data | `simulated` | `simulated` \| `finnhub` \| `alphavantage` |
| `FINNHUB_API_KEY` / `ALPHAVANTAGE_API_KEY` | market-data | — | Required only for the matching provider |
| `REDIS_URL` | market-data | — | Optional L2 cache, e.g. `redis://localhost:6379/0` |
| `QUOTE_TTL_L1` / `QUOTE_TTL_L2` | market-data | `5` / `30` | Cache TTLs in seconds |
| `PROVIDER_RATE_LIMIT_PER_SEC` / `PROVIDER_BURST` | market-data | `10` / `20` | Token-bucket settings |
| `TICK_INTERVAL` | market-data | `1.0` | WebSocket tick seconds |
| `PORT` | api | `5000` | |
| `MONGO_URI` | api | `mongodb://localhost:27017/smarttrader` | |
| `JWT_SECRET` | api | `dev-secret-change-me` | **Change in production** |
| `MARKET_DATA_URL` | api | `http://localhost:8000` | |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | api | — | Empty = stub mode |
| `VITE_API_URL` | client | `http://localhost:5000` | |
| `VITE_MARKET_DATA_WS` | client | `ws://localhost:8000/ws/ticks` | |

## API reference

Market-data (`:8000`): `GET /health`, `GET /api/instruments`,
`GET /api/quotes?symbols=AAPL,MSFT`, `GET /api/history/{symbol}?points=60`,
`POST /api/valuate`, `GET /api/stats`, `WS /ws/ticks?symbols=...`.

API (`:5000`), all `/api/*` except auth register/login require
`Authorization: Bearer <token>`:

| Method & path | Description |
|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` | Create session (returns JWT) |
| `GET /api/auth/me` | Current user |
| `GET /api/portfolio` | Cash + holdings valued at live prices |
| `POST /api/trades` `{symbol, side, qty}` | Execute buy/sell at market price |
| `GET /api/transactions?type=&symbol=&limit=` | Ledger, newest first |
| `GET /api/funding/config` | Stripe publishable key + stub-mode flag |
| `POST /api/funding/intent` `{amount}` | Create PaymentIntent (or stub) |
| `POST /api/funding/confirm` `{paymentIntentId}` | Verify + credit, idempotent |
| `GET /api/market/instruments` · `/quotes` · `/history/:symbol` · `/stats` | Market-data proxies |
| `GET/POST/DELETE /api/watchlist` | Watchlist with live quotes |

## Project structure

```
smarttrader/
├── market-data/        # FastAPI service
│   ├── app/
│   │   ├── data_manager.py   # centralized Data Manager
│   │   ├── rate_limiter.py   # async token bucket
│   │   ├── cache.py          # LRU L1 + Redis L2
│   │   ├── providers.py      # simulated / Finnhub / Alpha Vantage
│   │   ├── instruments.py    # 12-symbol universe
│   │   └── main.py           # REST + WebSocket
│   └── tests/                # 26 pytest tests
├── api/                # Express service
│   ├── src/routes/     # auth, portfolio, trades, transactions, funding, market, watchlist
│   ├── src/lib/        # market-data client, Stripe wrapper (real + stub)
│   ├── src/seed.js     # demo account seed
│   └── tests/          # 23 jest tests (supertest + mongodb-memory-server)
├── client/             # React + Vite dashboard
│   └── src/
│       ├── pages/      # Dashboard, Trade, Watchlist, Transactions, Funding, Login/Register
│       ├── components/ # hand-rolled SVG Sparkline + Donut
│       └── lib/        # api client, WebSocket tick hook, formatters
└── docker-compose.yml
```

## Testing

```bash
cd market-data && .venv/bin/python -m pytest -q   # 26 passed
cd api && npm test                                 # 23 passed
cd client && npm test && npm run build             # 13 passed, clean build
```

## Honest scope notes

- Prices come from a **simulated feed** unless you configure a real
  provider key — fine for demos, not for real trading decisions.
- This is a **paper-trading** app: Stripe funding uses test mode (or the
  local stub); no real money moves.
- No Stripe webhook handler — deposits are confirmed client-side via the
  confirm endpoint; a production deployment should verify via webhooks.
- Auth is email/password + JWT; no 2FA, no KYC.
- The demo seed uses fixed historical-ish cost bases; live prices drift
  from the simulated walk.
