require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/smarttrader",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: "7d",
  marketDataUrl: process.env.MARKET_DATA_URL || "http://localhost:8000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  // When no Stripe keys are configured the API runs in stub mode: funding
  // works end to end locally without touching Stripe's network.
  stripeStubMode: !process.env.STRIPE_SECRET_KEY,
};
