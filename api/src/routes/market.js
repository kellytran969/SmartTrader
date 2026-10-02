const express = require("express");
const { authRequired } = require("../middleware/auth");
const marketData = require("../lib/marketData");

const router = express.Router();
router.use(authRequired);

// Read-only proxies to the Python market-data service.

router.get("/instruments", async (req, res, next) => {
  try {
    return res.json(await marketData.getInstruments());
  } catch (err) {
    return next(err);
  }
});

router.get("/quotes", async (req, res, next) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ error: "symbols required" });
    const list = String(symbols)
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return res.json(await marketData.getQuotes(list));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.get("/history/:symbol", async (req, res, next) => {
  try {
    const points = Math.min(500, Math.max(1, parseInt(req.query.points, 10) || 60));
    return res.json(
      await marketData.getHistory(req.params.symbol.toUpperCase(), points)
    );
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    return res.json(await marketData.getStats());
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
