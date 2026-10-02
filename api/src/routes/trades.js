const express = require("express");
const { User, Transaction } = require("../db");
const { authRequired } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const marketData = require("../lib/marketData");
const { portfolioSummary } = require("./portfolio");

const router = express.Router();
router.use(authRequired);

router.post("/", validate(schemas.trade), async (req, res, next) => {
  try {
    const { symbol: rawSymbol, side, qty } = req.validated.body;
    const symbol = rawSymbol.toUpperCase();

    let quotes;
    try {
      quotes = await marketData.getQuotes([symbol]);
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: `unknown symbol: ${symbol}` });
      }
      throw err;
    }
    const price = quotes[0].price;
    const total = Math.round(price * qty * 100) / 100;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });

    if (side === "buy") {
      if (user.cash < total) {
        return res.status(400).json({
          error: "insufficient cash",
          needed: total,
          available: user.cash,
        });
      }
      user.cash = Math.round((user.cash - total) * 100) / 100;
      const holding = user.holdings.find((h) => h.symbol === symbol);
      if (holding) {
        const newQty = holding.qty + qty;
        holding.avgCost =
          Math.round(((holding.qty * holding.avgCost + total) / newQty) * 100) / 100;
        holding.qty = newQty;
      } else {
        user.holdings.push({ symbol, qty, avgCost: price });
      }
    } else {
      const holding = user.holdings.find((h) => h.symbol === symbol);
      if (!holding || holding.qty < qty) {
        return res.status(400).json({
          error: "insufficient holdings",
          held: holding ? holding.qty : 0,
          requested: qty,
        });
      }
      holding.qty = Math.round((holding.qty - qty) * 1e8) / 1e8;
      if (holding.qty <= 0) {
        user.holdings = user.holdings.filter((h) => h.symbol !== symbol);
      }
      user.cash = Math.round((user.cash + total) * 100) / 100;
    }

    await user.save();
    const tx = await Transaction.create({
      user: user._id,
      type: side,
      symbol,
      qty,
      price,
      total,
    });

    return res.status(201).json({
      transaction: {
        id: tx._id,
        type: tx.type,
        symbol,
        qty,
        price,
        total,
        ts: tx.ts,
      },
      portfolio: await portfolioSummary(user),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
