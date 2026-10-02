import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Funding, Portfolio } from "../lib/api.js";
import { fmtUSD } from "../lib/format.js";

function RealStripeForm({ clientSecret, amount, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pay = async (e) => {
    e.preventDefault();
    setError("");
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: elements.getElement(CardElement) },
        });
      if (stripeError) throw new Error(stripeError.message);
      const res = await Funding.confirm(paymentIntent.id);
      onDone(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={pay}>
      <label>Card (test mode)</label>
      <div style={{ background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
        <CardElement options={{ style: { base: { color: "#e8edf5", fontSize: "14px" } } }} />
      </div>
      <p className="hint">Use Stripe test card 4242 4242 4242 4242, any future expiry, any CVC.</p>
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy || !stripe} style={{ marginTop: 12 }}>
        {busy ? "Processing…" : `Pay ${fmtUSD(amount)}`}
      </button>
    </form>
  );
}

function FundingInner() {
  const [cfg, setCfg] = useState(null);
  const [cash, setCash] = useState(null);
  const [amount, setAmount] = useState("100");
  const [intent, setIntent] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Funding.config().then(setCfg).catch((e) => setError(e.message));
    Portfolio.get().then((p) => setCash(p.cash)).catch(() => {});
  }, []);

  const start = async (e) => {
    e.preventDefault();
    setError("");
    setDone(null);
    const amt = parseFloat(amount);
    if (!(amt >= 5 && amt <= 100000)) {
      setError("Amount must be between $5 and $100,000.");
      return;
    }
    setBusy(true);
    try {
      const res = await Funding.intent(amt);
      if (res.stubMode) {
        // Stub mode: no card needed — confirm immediately.
        const confirmed = await Funding.confirm(res.paymentIntentId);
        setDone(confirmed);
        setCash(confirmed.cash);
      } else {
        setIntent(res);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const stripePromise =
    cfg && cfg.publishableKey ? loadStripe(cfg.publishableKey) : null;

  return (
    <div>
      <h1 className="page-title">Funding</h1>
      <p className="page-sub">Add cash to your account via Stripe.</p>
      {error && <div className="error">{error}</div>}
      {done && (
        <div className="success">
          Deposit confirmed: {fmtUSD(done.credited)} — new balance {fmtUSD(done.cash)}.
        </div>
      )}
      <div className="grid-2">
        <div className="panel">
          <h3>Balance</h3>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
            {cash === null ? "…" : fmtUSD(cash)}
          </div>
          <form onSubmit={start} style={{ marginTop: 12 }}>
            <label>Deposit amount (USD)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <button className="btn" disabled={busy} style={{ marginTop: 12 }}>
              {busy ? "Working…" : "Continue"}
            </button>
          </form>
          {cfg?.stubMode && (
            <p className="hint">
              Demo mode: no Stripe keys configured, so deposits are simulated
              locally end to end. Add your own test keys to charge real test cards.
            </p>
          )}
        </div>
        <div className="panel">
          <h3>Payment</h3>
          {!intent ? (
            <p className="hint">Enter an amount and continue to pay.</p>
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
              <RealStripeForm
                clientSecret={intent.clientSecret}
                amount={intent.amount}
                onDone={(res) => {
                  setDone(res);
                  setCash(res.cash);
                  setIntent(null);
                }}
              />
            </Elements>
          ) : (
            <p className="hint">Stripe is not configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FundingPage() {
  return <FundingInner />;
}
