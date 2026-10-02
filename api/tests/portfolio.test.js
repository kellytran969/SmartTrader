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

describe("portfolio", () => {
  test("returns cash, valued holdings, and total equity", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "pf@example.com", password: "password123" });
    const user = await User.findById(reg.body.user.id);
    user.cash = 5000;
    user.holdings.push({ symbol: "AAPL", qty: 10, avgCost: 200 });
    await user.save();

    const res = await request(app)
      .get("/api/portfolio")
      .set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.cash).toBe(5000);
    expect(res.body.holdings).toHaveLength(1);
    expect(res.body.holdings[0].market_value).toBe(10 * PRICES.AAPL);
    expect(res.body.holdings[0].unrealized_pnl).toBe(10 * (PRICES.AAPL - 200));
    expect(res.body.totalMarketValue).toBe(10 * PRICES.AAPL);
    expect(res.body.totalEquity).toBe(5000 + 10 * PRICES.AAPL);
  });

  test("empty portfolio has zero market value", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "empty@example.com", password: "password123" });
    const res = await request(app)
      .get("/api/portfolio")
      .set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.holdings).toEqual([]);
    expect(res.body.totalMarketValue).toBe(0);
    expect(res.body.totalEquity).toBe(0);
  });

  test("transactions list returns newest first", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "tx@example.com", password: "password123" });
    const token = reg.body.token;
    const user = await User.findById(reg.body.user.id);
    user.cash = 100000;
    await user.save();
    const headers = { Authorization: `Bearer ${token}` };
    await request(app).post("/api/trades").set(headers).send({
      symbol: "AAPL",
      side: "buy",
      qty: 1,
    });
    await request(app).post("/api/trades").set(headers).send({
      symbol: "MSFT",
      side: "buy",
      qty: 1,
    });
    const res = await request(app).get("/api/transactions").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].symbol).toBe("MSFT"); // newest first
    const filtered = await request(app)
      .get("/api/transactions?type=buy&symbol=AAPL")
      .set(headers);
    expect(filtered.body.transactions).toHaveLength(1);
  });
});
