const express = require("express");
const config = require("../config");
const { User, Transaction } = require("../db");
const { authRequired } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const stripeClient = require("../lib/stripeClient");

const router = express.Router();
router.use(authRequired);

router.get("/config", (req, res) => {
  res.json({
    publishableKey: config.stripePublishableKey,
    stubMode: stripeClient.stubMode,
  });
});

router.post("/intent", validate(schemas.fundingIntent), async (req, res, next) => {
  try {
    const { amount } = req.validated.body;
    const intent = await stripeClient.createPaymentIntent(amount);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    user.fundingIntents.push({
      intentId: intent.id,
      amount,
      status: "pending",
    });
    await user.save();
    return res.status(201).json({
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
      stubMode: intent.stubMode,
      amount,
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  "/confirm",
  validate(schemas.fundingConfirm),
  async (req, res, next) => {
    try {
      const { paymentIntentId } = req.validated.body;
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "user not found" });

      const record = user.fundingIntents.find(
        (f) => f.intentId === paymentIntentId
      );
      if (!record) {
        return res.status(404).json({ error: "unknown payment intent" });
      }
      // Idempotent: confirming twice must not double-credit.
      if (record.status === "succeeded") {
        return res.json({ cash: user.cash, alreadyCredited: true });
      }

      const { paid, amountDollars } = await stripeClient.verifyPaid(
        paymentIntentId
      );
      if (!paid) {
        record.status = "failed";
        await user.save();
        return res.status(402).json({ error: "payment not completed" });
      }
      const credited = amountDollars ?? record.amount;
      // Sanity check: the paid amount must match what we asked for.
      if (Math.abs(credited - record.amount) > 0.009) {
        record.status = "failed";
        await user.save();
        return res.status(400).json({ error: "amount mismatch" });
      }
      record.status = "succeeded";
      user.cash = Math.round((user.cash + record.amount) * 100) / 100;
      await user.save();
      await Transaction.create({
        user: user._id,
        type: "deposit",
        total: record.amount,
        meta: { paymentIntentId },
      });
      return res.json({ cash: user.cash, credited: record.amount });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
