const jwt = require("jsonwebtoken");
const config = require("../config");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

module.exports = { authRequired };
