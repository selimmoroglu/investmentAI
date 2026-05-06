"use client";

interface Point {
  label: string;
  value: number;
}

interface LineChartProps {
  data: Point[];
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  unit?: string;
}

export function LineChart({ data, color = "var(--chart-gold)", height = 160, formatY, unit = "" }: LineChartProps) {
  if (data.length < 2) return null;

  const vals = data.map((d) => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const W = 400;
  const H = height - 28;
  const padL = 48;
  const padR = 8;
  const padT = 12;

  const toX = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const toY = (v: number) => padT + (1 - (v - minV) / range) * (H - padT);

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const fmt = formatY || ((v: number) => v.toFixed(1) + unit);

  // Grid lines
  const gridVals = [minV, (minV + maxV) / 2, maxV];

  return (
    <div style={{ width: "100%", height: height + 20, position: "relative" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {gridVals.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4"/>
              <text x={padL - 4} y={y + 4} fill="var(--text-muted)" fontSize={9} textAnchor="end">{fmt(v)}</text>
            </g>
          );
        })}

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="var(--bg-card)" strokeWidth={1.5}>
            <title>{data[i].label}: {fmt(data[i].value)}</title>
          </circle>
        ))}
      </svg>

      {/* X labels */}
      <div style={{ position: "absolute", bottom: 0, left: padL, right: padR, display: "flex", justifyContent: "space-between" }}>
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i} style={{ color: "var(--text-muted)", fontSize: 9 }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
