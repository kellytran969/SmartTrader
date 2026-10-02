const express = require("express");
const { Transaction } = require("../db");
const { authRequired } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();
router.use(authRequired);

router.get(
  "/",
  validate(schemas.transactionsQuery),
  async (req, res, next) => {
    try {
      const { type, symbol, limit } = req.validated.query;
      const filter = { user: req.userId };
      if (type) filter.type = type;
      if (symbol) filter.symbol = symbol.toUpperCase();
      const txs = await Transaction.find(filter)
        .sort({ ts: -1 })
        .limit(limit)
        .lean();
      return res.json({
        transactions: txs.map((t) => ({
          id: t._id,
          type: t.type,
          symbol: t.symbol,
          qty: t.qty,
          price: t.price,
          total: t.total,
          ts: t.ts,
        })),
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
