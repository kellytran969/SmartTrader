/**
 * Seed a demo account with a starter portfolio and transaction history.
 *
 *   node src/seed.js
 *
 * Demo credentials: demo@smarttrader.dev / demo1234
 */
const bcrypt = require("bcryptjs");
const config = require("./config");
const { connect, User, Transaction } = require("./db");

const DEMO = {
  email: "demo@smarttrader.dev",
  password: "demo1234",
  cash: 18400.0,
  holdings: [
    { symbol: "AAPL", qty: 10, avgCost: 215.3 },
    { symbol: "NVDA", qty: 8, avgCost: 121.75 },
    { symbol: "SPY", qty: 15, avgCost: 572.1 },
    { symbol: "BTC", qty: 0.15, avgCost: 88400.0 },
  ],
  watchlist: ["TSLA", "ETH", "QQQ", "MSFT"],
};

async function main() {
  await connect(config.mongoUri);
  await User.deleteOne({ email: DEMO.email });
  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  const user = await User.create({
    email: DEMO.email,
    passwordHash,
    cash: DEMO.cash,
    holdings: DEMO.holdings,
    watchlist: DEMO.watchlist,
  });
  await Transaction.deleteMany({ user: user._id });
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const seedTx = [
    { type: "deposit", total: 30000, daysAgo: 30, meta: { note: "seed deposit" } },
    { type: "buy", symbol: "AAPL", qty: 10, price: 215.3, total: 2153.0, daysAgo: 21 },
    { type: "buy", symbol: "NVDA", qty: 8, price: 121.75, total: 974.0, daysAgo: 14 },
    { type: "buy", symbol: "SPY", qty: 15, price: 572.1, total: 8581.5, daysAgo: 9 },
    { type: "buy", symbol: "BTC", qty: 0.15, price: 88400.0, total: 13260.0, daysAgo: 4 },
  ];
  for (const t of seedTx) {
    await Transaction.create({
      user: user._id,
      type: t.type,
      symbol: t.symbol,
      qty: t.qty,
      price: t.price,
      total: t.total,
      meta: t.meta || {},
      ts: new Date(now - t.daysAgo * day),
    });
  }
  console.log(`seeded ${DEMO.email} / ${DEMO.password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
