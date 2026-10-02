import { useCallback, useEffect, useState } from "react";
import { Watchlist } from "../lib/api.js";
import { useTicks } from "../lib/useTicks.js";
import { fmtPrice } from "../lib/format.js";

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await Watchlist.get();
      setSymbols(data.watchlist);
      setQuotes(data.quotes);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ticks = useTicks(symbols);
  const live = (s, fallback) => ticks[s]?.price ?? fallback;

  const add = async (e) => {
    e.preventDefault();
    setError("");
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    try {
      const data = await Watchlist.add(symbol);
      setInput("");
      setSymbols(data.watchlist);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (symbol) => {
    const data = await Watchlist.remove(symbol);
    setSymbols(data.watchlist);
    load();
  };

  const quoteBy = (s) => quotes.find((q) => q.symbol === s);

  return (
    <div>
      <h1 className="page-title">Watchlist</h1>
      <p className="page-sub">Symbols you are tracking, with live prices.</p>
      {error && <div className="error">{error}</div>}
      <div className="panel">
        <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Add symbol, e.g. TSLA"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button className="btn" type="submit">Add</button>
        </form>
        {symbols.length === 0 ? (
          <p className="hint">Your watchlist is empty.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Live price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((s) => (
                <tr key={s}>
                  <td className="mono"><strong>{s}</strong></td>
                  <td className="num mono">
                    <span className="live-dot" />
                    {quoteBy(s) ? fmtPrice(live(s, quoteBy(s).price)) : "…"}
                  </td>
                  <td className="num">
                    <button className="btn secondary" onClick={() => remove(s)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
