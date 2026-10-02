import { describe, expect, test } from "vitest";
import { fmtUSD, fmtPrice, fmtPct, fmtQty, pnlClass } from "../lib/format.js";

describe("fmtUSD", () => {
  test("formats dollars with cents", () => {
    expect(fmtUSD(1234.5)).toBe("$1,234.50");
  });
  test("handles zero and negatives", () => {
    expect(fmtUSD(0)).toBe("$0.00");
    expect(fmtUSD(-42.1)).toBe("-$42.10");
  });
  test("returns placeholder for missing values", () => {
    expect(fmtUSD(null)).toBe("—");
    expect(fmtUSD(undefined)).toBe("—");
  });
});

describe("fmtPrice", () => {
  test("crypto-sized prices drop cents", () => {
    expect(fmtPrice(97250.0)).toBe("$97,250");
  });
  test("stock prices keep cents", () => {
    expect(fmtPrice(232.5)).toBe("$232.50");
  });
});

describe("fmtPct", () => {
  test("adds a plus sign for gains", () => {
    expect(fmtPct(2.5)).toBe("+2.50%");
  });
  test("keeps the minus for losses", () => {
    expect(fmtPct(-1.234)).toBe("-1.23%");
  });
});

describe("fmtQty", () => {
  test("integers render without decimals", () => {
    expect(fmtQty(10)).toBe("10");
  });
  test("fractional crypto qty trims trailing zeros", () => {
    expect(fmtQty(0.1500)).toBe("0.15");
  });
});

describe("pnlClass", () => {
  test("maps sign to css class", () => {
    expect(pnlClass(5)).toBe("pos");
    expect(pnlClass(-5)).toBe("neg");
    expect(pnlClass(0)).toBe("");
  });
});
