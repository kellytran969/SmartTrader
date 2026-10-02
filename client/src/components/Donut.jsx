/** Allocation donut chart rendered with plain SVG. */
const COLORS = [
  "#3fb97f", "#4c8dff", "#b98a3f", "#9d4edd",
  "#e5484d", "#3fb9b0", "#d6409f", "#7d8ba3",
];

export default function Donut({ segments, size = 170 }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!segments.length || total <= 0)
    return <div className="hint">No holdings yet.</div>;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--panel-2)" strokeWidth="18" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={s.label}
              cx="70" cy="70" r={radius} fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${(frac * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
              strokeDashoffset={(-offset * circumference).toFixed(2)}
              transform="rotate(-90 70 70)"
            />
          );
          offset += frac;
          return el;
        })}
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central"
              fill="var(--text)" fontSize="15" fontWeight="700">
          {segments.length} assets
        </text>
      </svg>
      <div className="legend">
        {segments.map((s, i) => (
          <div className="legend-item" key={s.label}>
            <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="mono">{s.label}</span>
            <span style={{ color: "var(--text-dim)" }}>
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
