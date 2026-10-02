/** Lightweight SVG sparkline — no charting library needed. */
export default function Sparkline({
  data,
  width = 120,
  height = 36,
  strokeWidth = 1.5,
}) {
  if (!data || data.length < 2) return <span className="mono">—</span>;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const stepX = width / (prices.length - 1);
  const points = prices
    .map(
      (p, i) =>
        `${(i * stepX).toFixed(1)},${(
          height - 3 - ((p - min) / span) * (height - 6)
        ).toFixed(1)}`
    )
    .join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? "var(--accent)" : "var(--red)";
  return (
    <svg width={width} height={height} aria-label="price sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
