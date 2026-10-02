const express = require("express");
const { User } = require("../db");
const { authRequired } = require("../middleware/auth");
const marketData = require("../lib/marketData");

const router = express.Router();
router.use(authRequired);

async function portfolioSummary(user) {
  const holdings = user.holdings.map((h) => ({
    symbol: h.symbol,
    qty: h.qty,
    avg_cost: h.avgCost,
  }));
  let valuation = {
    positions: [],
    total_market_value: 0,
    total_cost: 0,
    total_unrealized_pnl: 0,
  };
  if (holdings.length > 0) {
    valuation = await marketData.valuate(holdings);
  }
  return {
    cash: user.cash,
    holdings: valuation.positions,
    totalMarketValue: valuation.total_market_value,
    totalUnrealizedPnl: valuation.total_unrealized_pnl,
    totalEquity: Math.round((user.cash + valuation.total_market_value) * 100) / 100,
    buyingPower: user.cash,
    ts: valuation.ts,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    return res.json(await portfolioSummary(user));
  } catch (err) {
    return next(err);
  }
});

module.exports = { router, portfolioSummary };
