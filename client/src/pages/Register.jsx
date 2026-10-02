import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Auth, setToken } from "../lib/api.js";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token } = await Auth.register(email, password);
      setToken(token);
      navigate("/funding");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="panel">
        <h1>Create account</h1>
        <p className="page-sub">New accounts start with $0 — fund via Stripe to trade.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <label>Password (min 8 characters)</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
          <div style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
        <p className="hint">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
