const mongoose = require("mongoose");

const holdingSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    avgCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const fundingIntentSchema = new mongoose.Schema(
  {
    intentId: { type: String, required: true },
    amount: { type: Number, required: true }, // dollars
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    cash: { type: Number, default: 0, min: 0 },
    holdings: { type: [holdingSchema], default: [] },
    watchlist: { type: [String], default: [] },
    fundingIntents: { type: [fundingIntentSchema], default: [] },
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["buy", "sell", "deposit"], required: true },
  symbol: { type: String, uppercase: true, trim: true },
  qty: { type: Number, min: 0 },
  price: { type: Number, min: 0 },
  total: { type: Number, required: true, min: 0 }, // dollars moved
  meta: { type: Object, default: {} },
  ts: { type: Date, default: Date.now },
});
transactionSchema.index({ user: 1, ts: -1 });

const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

async function connect(uri) {
  await mongoose.connect(uri);
}

module.exports = { connect, User, Transaction };
