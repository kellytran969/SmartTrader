const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { User } = require("../db");
const { validate, schemas } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    cash: user.cash,
    createdAt: user.createdAt,
  };
}

router.post("/register", validate(schemas.register), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    // New accounts start with $0 cash; fund via the Stripe funding flow.
    const user = await User.create({ email, passwordHash, cash: 0 });
    const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
    return res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", validate(schemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
    return res.json({ user: publicUser(user), token });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
