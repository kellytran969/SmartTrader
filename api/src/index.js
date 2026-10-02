const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { connect } = require("./db");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

app.get("/health", (req, res) =>
  res.json({ status: "ok", stripeStubMode: config.stripeStubMode })
);

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/portfolio", require("./routes/portfolio").router);
app.use("/api/trades", require("./routes/trades"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/funding", require("./routes/funding"));
app.use("/api/market", require("./routes/market"));
app.use("/api/watchlist", require("./routes/watchlist"));

app.use((req, res) => res.status(404).json({ error: "not found" }));

// Central error handler: never leak stack traces to clients.
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-unused-vars
  void next;
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: "internal server error" });
});

async function start() {
  await connect(config.mongoUri);
  app.listen(config.port, () =>
    console.log(`smarttrader-api listening on :${config.port}`)
  );
}

if (require.main === module) {
  start().catch((err) => {
    console.error("failed to start:", err);
    process.exit(1);
  });
}

module.exports = app;
