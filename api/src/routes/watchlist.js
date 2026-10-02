const express = require("express");
const { User } = require("../db");
const { authRequired } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const marketData = require("../lib/marketData");

const router = express.Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const symbols = user.watchlist;
    let quotes = [];
    if (symbols.length > 0) {
      quotes = await marketData.getQuotes(symbols);
    }
    return res.json({ watchlist: user.watchlist, quotes });
  } catch (err) {
    return next(err);
  }
});

router.post("/", validate(schemas.watchlistAdd), async (req, res, next) => {
  try {
    const symbol = req.validated.body.symbol.toUpperCase();
    // Validate the symbol exists before adding.
    try {
      await marketData.getQuotes([symbol]);
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: `unknown symbol: ${symbol}` });
      }
      throw err;
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    if (!user.watchlist.includes(symbol)) {
      user.watchlist.push(symbol);
      await user.save();
    }
    return res.status(201).json({ watchlist: user.watchlist });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:symbol", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    user.watchlist = user.watchlist.filter(
      (s) => s !== req.params.symbol.toUpperCase()
    );
    await user.save();
    return res.json({ watchlist: user.watchlist });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
