import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Auth, setToken } from "../lib/api.js";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@smarttrader.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token } = await Auth.login(email, password);
      setToken(token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="panel">
        <h1>
          Smart<span style={{ color: "var(--accent)" }}>Trader</span>
        </h1>
        <p className="page-sub">Log in to your trading terminal.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          <div style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </div>
        </form>
        <p className="hint">
          No account? <Link to="/register">Create one</Link>
        </p>
        <p className="hint">Demo account: demo@smarttrader.dev / demo1234</p>
      </div>
    </div>
  );
}
