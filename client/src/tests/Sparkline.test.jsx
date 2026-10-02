import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Sparkline from "../components/Sparkline.jsx";

const rising = [
  { t: 1, price: 100 },
  { t: 2, price: 105 },
  { t: 3, price: 110 },
];
const falling = [
  { t: 1, price: 110 },
  { t: 2, price: 105 },
  { t: 3, price: 100 },
];

describe("Sparkline", () => {
  test("renders an svg with one point per datum", () => {
    render(<Sparkline data={rising} />);
    const polyline = document.querySelector("polyline");
    expect(polyline).toBeTruthy();
    expect(polyline.getAttribute("points").trim().split(" ")).toHaveLength(3);
  });

  test("rising data uses the up color, falling the down color", () => {
    const { unmount } = render(<Sparkline data={rising} />);
    expect(document.querySelector("polyline").getAttribute("stroke")).toBe(
      "var(--accent)"
    );
    unmount();
    render(<Sparkline data={falling} />);
    expect(document.querySelector("polyline").getAttribute("stroke")).toBe(
      "var(--red)"
    );
  });

  test("renders a placeholder when there is not enough data", () => {
    render(<Sparkline data={[{ t: 1, price: 100 }]} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(document.querySelector("polyline")).toBeNull();
  });
});
