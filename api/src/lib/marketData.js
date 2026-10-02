/** Thin HTTP client for the Python market-data service. */

const config = require("../config");

async function mdFetch(path, options = {}) {
  const res = await fetch(`${config.marketDataUrl}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`market-data ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getInstruments() {
  return mdFetch("/api/instruments");
}

async function getQuotes(symbols) {
  const list = Array.isArray(symbols) ? symbols : [symbols];
  return mdFetch(`/api/quotes?symbols=${encodeURIComponent(list.join(","))}`);
}

async function getHistory(symbol, points = 60) {
  return mdFetch(
    `/api/history/${encodeURIComponent(symbol)}?points=${points}`
  );
}

async function valuate(holdings) {
  return mdFetch("/api/valuate", {
    method: "POST",
    body: JSON.stringify({ holdings }),
  });
}

async function getStats() {
  return mdFetch("/api/stats");
}

module.exports = { getInstruments, getQuotes, getHistory, valuate, getStats };
