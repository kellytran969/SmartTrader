import { useCallback, useEffect, useState } from "react";
import { Market, Portfolio } from "../lib/api.js";
import { useTicks } from "../lib/useTicks.js";
import { fmtUSD, fmtPrice, fmtPct, fmtQty, pnlClass } from "../lib/format.js";
import Sparkline from "../components/Sparkline.jsx";
import Donut from "../components/Donut.jsx";

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [histories, setHistories] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const pf = await Portfolio.get();
      setPortfolio(pf);
      const syms = pf.holdings.map((h) => h.symbol);
      const results = await Promise.all(
        syms.map((s) => Market.history(s, 60).catch(() => []))
      );
      const map = {};
      syms.forEach((s, i) => (map[s] = results[i]));
      setHistories(map);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const symbols = portfolio ? portfolio.holdings.map((h) => h.symbol) : [];
  const ticks = useTicks(symbols);

  if (error) return <div className="error">{error}</div>;
  if (!portfolio) return <p className="page-sub">Loading portfolio…</p>;

  const livePrice = (h) => ticks[h.symbol]?.price ?? h.price;
  const liveValue = (h) => livePrice(h) * h.qty;
  const liveTotal = portfolio.holdings.reduce((a, h) => a + liveValue(h), 0);
  const liveEquity = portfolio.cash + liveTotal;
  const livePnl = portfolio.holdings.reduce(
    (a, h) => a + (livePrice(h) - h.avg_cost) * h.qty,
    0
  );

  return (
    <div>
      <h1 className="page-title">
        <span className="live-dot" /> Dashboard
      </h1>
      <p className="page-sub">Real-time portfolio tracking — prices stream live.</p>

      <div className="cards">
        <div className="card">
          <div className="label">Total equity</div>
          <div className="value mono">{fmtUSD(liveEquity)}</div>
        </div>
        <div className="card">
          <div className="label">Cash</div>
          <div className="value mono">{fmtUSD(portfolio.cash)}</div>
        </div>
        <div className="card">
          <div className="label">Invested</div>
          <div className="value mono">{fmtUSD(liveTotal)}</div>
        </div>
        <div className="card">
          <div className="label">Unrealized P&amp;L</div>
          <div className={`value mono ${pnlClass(livePnl)}`}>
            {livePnl >= 0 ? "+" : ""}
            {fmtUSD(livePnl)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Allocation</h3>
          <Donut
            segments={portfolio.holdings.map((h) => ({
              label: h.symbol,
              value: liveValue(h),
            }))}
          />
        </div>
        <div className="panel">
          <h3>Positions</h3>
          {portfolio.holdings.length === 0 ? (
            <p className="hint">No positions yet — head to Trade to buy your first asset.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Qty</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Live price</th>
                  <th className="num">Value</th>
                  <th className="num">P&amp;L</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => {
                  const pnl = (livePrice(h) - h.avg_cost) * h.qty;
                  const pct = h.avg_cost ? (pnl / (h.avg_cost * h.qty)) * 100 : 0;
                  return (
                    <tr key={h.symbol}>
                      <td className="mono"><strong>{h.symbol}</strong></td>
                      <td className="num mono">{fmtQty(h.qty)}</td>
                      <td className="num mono">{fmtPrice(h.avg_cost)}</td>
                      <td className="num mono">{fmtPrice(livePrice(h))}</td>
                      <td className="num mono">{fmtUSD(liveValue(h))}</td>
                      <td className={`num mono ${pnlClass(pnl)}`}>
                        {fmtUSD(pnl)} ({fmtPct(pct)})
                      </td>
                      <td><Sparkline data={histories[h.symbol]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
