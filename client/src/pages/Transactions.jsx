import { useEffect, useState } from "react";
import { Transactions } from "../lib/api.js";
import { fmtUSD, fmtPrice, fmtQty, timeAgo } from "../lib/format.js";

export default function TransactionsPage() {
  const [txs, setTxs] = useState([]);
  const [type, setType] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Transactions.list(type ? { type } : {})
      .then((d) => setTxs(d.transactions))
      .catch((err) => setError(err.message));
  }, [type]);

  return (
    <div>
      <h1 className="page-title">Transactions</h1>
      <p className="page-sub">Every trade and deposit on your account.</p>
      {error && <div className="error">{error}</div>}
      <div className="panel">
        <div style={{ marginBottom: 12 }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All types</option>
            <option value="buy">Buys</option>
            <option value="sell">Sells</option>
            <option value="deposit">Deposits</option>
          </select>
        </div>
        {txs.length === 0 ? (
          <p className="hint">No transactions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Symbol</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Total</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td><span className={`badge ${t.type}`}>{t.type}</span></td>
                  <td className="mono">{t.symbol || "—"}</td>
                  <td className="num mono">{t.qty ? fmtQty(t.qty) : "—"}</td>
                  <td className="num mono">{t.price ? fmtPrice(t.price) : "—"}</td>
                  <td className="num mono">{fmtUSD(t.total)}</td>
                  <td style={{ color: "var(--text-dim)" }}>{timeAgo(t.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
