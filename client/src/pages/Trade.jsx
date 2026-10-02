import { useEffect, useMemo, useState } from "react";
import { Market, Portfolio, Trades } from "../lib/api.js";
import { useTicks } from "../lib/useTicks.js";
import { fmtUSD, fmtPrice, fmtPct, pnlClass } from "../lib/format.js";
import Sparkline from "../components/Sparkline.jsx";

export default function Trade() {
  const [instruments, setInstruments] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("AAPL");
  const [side, setSide] = useState("buy");
  const [qty, setQty] = useState("1");
  const [cash, setCash] = useState(null);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Market.instruments().then(setInstruments).catch(() => {});
    Portfolio.get().then((p) => setCash(p.cash)).catch(() => {});
  }, []);

  useEffect(() => {
    setHistory([]);
    Market.history(selected, 120).then(setHistory).catch(() => {});
  }, [selected]);

  const ticks = useTicks([selected]);
  const price = ticks[selected]?.price;
  const qtyNum = parseFloat(qty);
  const estTotal = price && qtyNum > 0 ? price * qtyNum : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return instruments;
    return instruments.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    );
  }, [instruments, query]);

  const last = history[history.length - 1]?.price;
  const first = history[0]?.price;
  const dayChange = last && first ? ((last - first) / first) * 100 : null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!(qtyNum > 0)) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    setBusy(true);
    try {
      const res = await Trades.place(selected, side, qtyNum);
      setResult(res.transaction);
      setCash(res.portfolio.cash);
      setQty("1");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Trade</h1>
      <p className="page-sub">Live quotes, instant execution against your cash balance.</p>
      <div className="ticket">
        <div className="panel">
          <input
            placeholder="Search symbols or names…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {filtered.map((i) => (
              <div
                key={i.symbol}
                className={`quote-row${i.symbol === selected ? " selected" : ""}`}
                onClick={() => setSelected(i.symbol)}
              >
                <div>
                  <div className="mono"><strong>{i.symbol}</strong></div>
                  <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{i.name}</div>
                </div>
                <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12 }}>{i.type}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 className="mono">{selected}</h3>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
            {price ? fmtPrice(price) : "…"}
          </div>
          {dayChange !== null && (
            <div className={pnlClass(dayChange)} style={{ marginBottom: 8 }}>
              {fmtPct(dayChange)} today
            </div>
          )}
          <Sparkline data={history} width={280} height={64} />
          <form onSubmit={submit}>
            <div className="side-toggle">
              <button type="button" className={`btn buy${side === "buy" ? " on" : ""}`} onClick={() => setSide("buy")}>
                Buy
              </button>
              <button type="button" className={`btn sell${side === "sell" ? " on" : ""}`} onClick={() => setSide("sell")}>
                Sell
              </button>
            </div>
            <label>Quantity</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="e.g. 10 or 0.5" />
            <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0" }}>
              <span style={{ color: "var(--text-dim)" }}>Est. total</span>
              <span className="mono"><strong>{fmtUSD(estTotal)}</strong></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "0 0 12px" }}>
              <span style={{ color: "var(--text-dim)" }}>Buying power</span>
              <span className="mono">{cash === null ? "…" : fmtUSD(cash)}</span>
            </div>
            <button className={`btn ${side}`} disabled={busy} style={{ width: "100%" }}>
              {busy ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${selected}`}
            </button>
          </form>
          {error && <div className="error">{error}</div>}
          {result && (
            <div className="success">
              {result.type === "buy" ? "Bought" : "Sold"} {result.qty} {result.symbol} @{" "}
              {fmtPrice(result.price)} ({fmtUSD(result.total)})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
