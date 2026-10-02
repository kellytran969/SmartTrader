/**
 * Shared mock for the Python market-data service.
 *
 * Each test file does `jest.mock("../../src/lib/marketData")` (hoisted), then
 * requires this module to install deterministic implementations.
 */

const PRICES = {
  AAPL: 230.0,
  MSFT: 425.0,
  NVDA: 135.5,
  TSLA: 250.0,
  AMZN: 197.0,
  GOOGL: 176.0,
  META: 585.0,
  SPY: 595.0,
  QQQ: 520.0,
  GLD: 244.0,
  BTC: 97000.0,
  ETH: 3400.0,
};

function install() {
  const marketData = require("../src/lib/marketData");

  marketData.getInstruments.mockImplementation(async () =>
    Object.entries(PRICES).map(([symbol, price]) => ({
      symbol,
      name: symbol,
      type: "stock",
      base_price: price,
    }))
  );

  marketData.getQuotes.mockImplementation(async (symbols) => {
    const list = Array.isArray(symbols) ? symbols : [symbols];
    const unknown = list.filter((s) => !(s in PRICES));
    if (unknown.length > 0) {
      const err = new Error(`market-data 400: unknown symbols: ${unknown}`);
      err.status = 400;
      throw err;
    }
    return list.map((s) => ({
      symbol: s,
      price: PRICES[s],
      ts: 1_700_000_000,
      provider: "mock",
    }));
  });

  marketData.valuate.mockImplementation(async (holdings) => {
    const positions = holdings.map((h) => {
      const price = PRICES[h.symbol] ?? 0;
      const market_value = Math.round(h.qty * price * 100) / 100;
      const cost = Math.round(h.qty * h.avg_cost * 100) / 100;
      return {
        symbol: h.symbol,
        qty: h.qty,
        avg_cost: h.avg_cost,
        price,
        market_value,
        unrealized_pnl: Math.round((market_value - cost) * 100) / 100,
        unrealized_pnl_pct: cost
          ? Math.round(((market_value - cost) / cost) * 100 * 100) / 100
          : 0,
      };
    });
    const total_market_value =
      Math.round(positions.reduce((a, p) => a + p.market_value, 0) * 100) / 100;
    const total_cost =
      Math.round(
        holdings.reduce((a, h) => a + h.qty * h.avg_cost, 0) * 100
      ) / 100;
    return {
      positions,
      total_market_value,
      total_cost,
      total_unrealized_pnl: Math.round((total_market_value - total_cost) * 100) / 100,
      ts: 1_700_000_000,
    };
  });

  marketData.getHistory.mockImplementation(async (symbol, points = 60) => {
    const price = PRICES[symbol] ?? 100;
    return Array.from({ length: points }, (_, i) => ({
      t: 1_700_000_000 - (points - 1 - i) * 60,
      price,
    }));
  });

  marketData.getStats.mockImplementation(async () => ({ provider: "mock" }));
}

module.exports = { install, PRICES };
