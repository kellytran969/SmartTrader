/** API client: JSON fetch wrapper with JWT handling. */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const MARKET_WS_URL =
  import.meta.env.VITE_MARKET_DATA_WS || "ws://localhost:8000/ws/ticks";

const TOKEN_KEY = "smarttrader_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `request failed (${res.status})`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

export const Auth = {
  login: (email, password) =>
    api("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (email, password) =>
    api("/api/auth/register", { method: "POST", body: { email, password } }),
  me: () => api("/api/auth/me"),
};

export const Portfolio = {
  get: () => api("/api/portfolio"),
};

export const Trades = {
  place: (symbol, side, qty) =>
    api("/api/trades", { method: "POST", body: { symbol, side, qty } }),
};

export const Transactions = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/transactions${q ? `?${q}` : ""}`);
  },
};

export const Funding = {
  config: () => api("/api/funding/config"),
  intent: (amount) =>
    api("/api/funding/intent", { method: "POST", body: { amount } }),
  confirm: (paymentIntentId) =>
    api("/api/funding/confirm", { method: "POST", body: { paymentIntentId } }),
};

export const Market = {
  instruments: () => api("/api/market/instruments"),
  quotes: (symbols) =>
    api(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`),
  history: (symbol, points = 60) =>
    api(`/api/market/history/${encodeURIComponent(symbol)}?points=${points}`),
};

export const Watchlist = {
  get: () => api("/api/watchlist"),
  add: (symbol) => api("/api/watchlist", { method: "POST", body: { symbol } }),
  remove: (symbol) =>
    api(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }),
};
