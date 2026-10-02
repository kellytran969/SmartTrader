jest.mock("../src/lib/marketData");

const request = require("supertest");
const app = require("../src/index");
const { Transaction } = require("../src/db");
const { connectTestDb, closeTestDb, clearDb } = require("./db");
require("./marketDataMock").install();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function authed() {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email: `f${Date.now()}${Math.random()}@example.com`, password: "password123" });
  return { token: reg.body.token, userId: reg.body.user.id };
}

describe("funding (stub mode)", () => {
  test("config reports stub mode without Stripe keys", async () => {
    const { token } = await authed();
    const res = await request(app)
      .get("/api/funding/config")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stubMode).toBe(true);
  });

  test("intent -> confirm credits cash exactly once", async () => {
    const { token, userId } = await authed();
    const intent = await request(app)
      .post("/api/funding/intent")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250 });
    expect(intent.status).toBe(201);
    expect(intent.body.paymentIntentId).toMatch(/^pi_stub_/);
    expect(intent.body.clientSecret).toBeTruthy();

    const confirm = await request(app)
      .post("/api/funding/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentIntentId: intent.body.paymentIntentId });
    expect(confirm.status).toBe(200);
    expect(confirm.body.cash).toBe(250);
    expect(confirm.body.credited).toBe(250);

    // Idempotent: confirming again must not double-credit.
    const again = await request(app)
      .post("/api/funding/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentIntentId: intent.body.paymentIntentId });
    expect(again.status).toBe(200);
    expect(again.body.alreadyCredited).toBe(true);
    expect(again.body.cash).toBe(250);

    const deposits = await Transaction.find({ user: userId, type: "deposit" });
    expect(deposits).toHaveLength(1);
    expect(deposits[0].total).toBe(250);
  });

  test("confirm rejects unknown intents", async () => {
    const { token } = await authed();
    const res = await request(app)
      .post("/api/funding/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentIntentId: "pi_stub_doesnotexist" });
    expect(res.status).toBe(404);
  });

  test("intent validates the amount range", async () => {
    const { token } = await authed();
    const tooSmall = await request(app)
      .post("/api/funding/intent")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 1 });
    expect(tooSmall.status).toBe(400);
  });
});
