/**
 * Stripe wrapper with a zero-setup stub mode.
 *
 * When STRIPE_SECRET_KEY is set, real PaymentIntents are created/confirmed
 * through Stripe. Otherwise the API runs in stub mode: funding works end to
 * end locally (intent -> confirm -> balance credited) without network calls,
 * so the app is fully demoable with no keys.
 */

const crypto = require("crypto");
const config = require("../config");

let stripe = null;
if (!config.stripeStubMode) {
  stripe = require("stripe")(config.stripeSecretKey);
}

function stubIntentId() {
  return `pi_stub_${crypto.randomBytes(12).toString("hex")}`;
}

async function createPaymentIntent(amountDollars) {
  const amountCents = Math.round(amountDollars * 100);
  if (config.stripeStubMode) {
    const id = stubIntentId();
    return {
      id,
      clientSecret: `${id}_secret_stub`,
      stubMode: true,
    };
  }
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { purpose: "smarttrader-funding" },
  });
  return { id: intent.id, clientSecret: intent.client_secret, stubMode: false };
}

/**
 * Verify a PaymentIntent is paid. Returns { paid: boolean, amountDollars }.
 * In stub mode any pi_stub_* id is treated as paid (local demo only).
 */
async function verifyPaid(intentId) {
  if (config.stripeStubMode) {
    if (!intentId.startsWith("pi_stub_")) {
      return { paid: false, amountDollars: 0 };
    }
    return { paid: true, amountDollars: null }; // amount taken from our record
  }
  const intent = await stripe.paymentIntents.retrieve(intentId);
  return {
    paid: intent.status === "succeeded",
    amountDollars: intent.amount_received / 100,
  };
}

module.exports = { createPaymentIntent, verifyPaid, stubMode: config.stripeStubMode };
