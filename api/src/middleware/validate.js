const { z } = require("zod");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return res.status(400).json({
        error: "validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    return next();
  };
}

const schemas = {
  register: z.object({
    body: z.object({
      email: z.string().email().max(254),
      password: z.string().min(8).max(128),
    }),
  }),
  login: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  trade: z.object({
    body: z.object({
      symbol: z.string().min(1).max(12),
      side: z.enum(["buy", "sell"]),
      qty: z.number().positive().max(1_000_000),
    }),
  }),
  fundingIntent: z.object({
    body: z.object({
      // dollars, $5 .. $100k per deposit
      amount: z.number().min(5).max(100_000),
    }),
  }),
  fundingConfirm: z.object({
    body: z.object({
      paymentIntentId: z.string().min(1).max(128),
    }),
  }),
  watchlistAdd: z.object({
    body: z.object({ symbol: z.string().min(1).max(12) }),
  }),
  transactionsQuery: z.object({
    query: z.object({
      type: z.enum(["buy", "sell", "deposit"]).optional(),
      symbol: z.string().max(12).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
};

module.exports = { validate, schemas };
