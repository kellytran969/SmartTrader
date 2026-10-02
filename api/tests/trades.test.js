jest.mock("../src/lib/marketData");

const request = require("supertest");
const app = require("../src/index");
const { User } = require("../src/db");
const { connectTestDb, closeTestDb, clearDb } = require("./db");
const { install, PRICES } = require("./marketDataMock");
install();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function authedUser(cash = 10000) {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email: `t${Date.now()}${Math.random()}@example.com`, password: "password123" });
  const user = await User.findById(reg.body.user.id);
  user.cash = cash;
  await user.save();
  return { token: reg.body.token, userId: reg.body.user.id };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe("trades", () => {
  test("buy deducts cash and creates a holding at market price", async () => {
    const { token } = await authedUser(10000);
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "buy", qty: 10 });
    expect(res.status).toBe(201);
    expect(res.body.transaction.price).toBe(PRICES.AAPL);
    expect(res.body.transaction.total).toBe(PRICES.AAPL * 10);
    const holding = res.body.portfolio.holdings.find((h) => h.symbol === "AAPL");
    expect(holding.qty).toBe(10);
    expect(holding.avg_cost).toBe(PRICES.AAPL);
    expect(res.body.portfolio.cash).toBe(10000 - PRICES.AAPL * 10);
  });

  test("second buy averages the cost basis", async () => {
    const { token, userId } = await authedUser(100000);
    // Seed an existing holding below market to check weighted averaging.
    const user = await User.findById(userId);
    user.holdings.push({ symbol: "AAPL", qty: 10, avgCost: 200 });
    await user.save();
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "aapl", side: "buy", qty: 10 });
    expect(res.status).toBe(201);
    const holding = res.body.portfolio.holdings.find((h) => h.symbol === "AAPL");
    expect(holding.qty).toBe(20);
    expect(holding.avg_cost).toBe((10 * 200 + 10 * PRICES.AAPL) / 20);
  });

  test("buy fails with insufficient cash", async () => {
    const { token } = await authedUser(100);
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "buy", qty: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("insufficient cash");
  });

  test("sell credits cash and reduces the holding", async () => {
    const { token } = await authedUser(10000);
    await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "buy", qty: 10 });
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "sell", qty: 4 });
    expect(res.status).toBe(201);
    expect(res.body.transaction.type).toBe("sell");
    const holding = res.body.portfolio.holdings.find((h) => h.symbol === "AAPL");
    expect(holding.qty).toBe(6);
  });

  test("selling everything removes the holding", async () => {
    const { token } = await authedUser(10000);
    await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "buy", qty: 10 });
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "sell", qty: 10 });
    expect(res.status).toBe(201);
    expect(
      res.body.portfolio.holdings.find((h) => h.symbol === "AAPL")
    ).toBeUndefined();
  });

  test("sell fails when holdings are insufficient", async () => {
    const { token } = await authedUser(10000);
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "sell", qty: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("insufficient holdings");
  });

  test("unknown symbol is rejected", async () => {
    const { token } = await authedUser(10000);
    const res = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "NOPE", side: "buy", qty: 1 });
    expect(res.status).toBe(400);
  });

  test("trade input is validated", async () => {
    const { token } = await authedUser(10000);
    const badQty = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "buy", qty: -5 });
    expect(badQty.status).toBe(400);
    const badSide = await request(app)
      .post("/api/trades")
      .set(auth(token))
      .send({ symbol: "AAPL", side: "hold", qty: 5 });
    expect(badSide.status).toBe(400);
  });

  test("trades require authentication", async () => {
    const res = await request(app)
      .post("/api/trades")
      .send({ symbol: "AAPL", side: "buy", qty: 1 });
    expect(res.status).toBe(401);
  });
});
