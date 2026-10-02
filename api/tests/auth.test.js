jest.mock("../src/lib/marketData");

const request = require("supertest");
const app = require("../src/index");
const { connectTestDb, closeTestDb, clearDb } = require("./db");
require("./marketDataMock").install();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe("auth", () => {
  test("register creates a user and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "trader@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("trader@example.com");
    expect(res.body.user.cash).toBe(0);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test("register rejects duplicate email", async () => {
    const body = { email: "dup@example.com", password: "password123" };
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  test("register validates email and password", async () => {
    const badEmail = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });
    expect(badEmail.status).toBe(400);
    const shortPw = await request(app)
      .post("/api/auth/register")
      .send({ email: "ok@example.com", password: "short" });
    expect(shortPw.status).toBe(400);
  });

  test("login returns a token for valid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", password: "password123" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test("login rejects wrong password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "wrongpw@example.com", password: "password123" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrongpw@example.com", password: "nope-nope-nope" });
    expect(res.status).toBe(401);
  });

  test("/me requires a bearer token", async () => {
    const noToken = await request(app).get("/api/auth/me");
    expect(noToken.status).toBe(401);
  });

  test("/me returns the current user", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "me@example.com", password: "password123" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@example.com");
  });
});
