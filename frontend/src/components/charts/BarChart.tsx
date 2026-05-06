"use client";

interface Bar {
  label: string;
  value: number;
}

interface BarChartProps {
  data: Bar[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

function fmtShort(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(1)}`;
}

export function BarChart({ data, color = "var(--chart-blue)", height = 140, formatValue = fmtShort }: BarChartProps) {
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => Math.abs(d.value)));
  const barW = 100 / (data.length * 2 - 1);

  return (
    <div style={{ height, width: "100%", position: "relative" }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {data.map((bar, i) => {
          const pct = max === 0 ? 0 : Math.abs(bar.value) / max;
          const barH = pct * (height - 24);
          const x = i * barW * 2;
          const isNeg = bar.value < 0;
          const barColor = isNeg ? "var(--down)" : color;
          return (
            <g key={i}>
              <rect
                x={`${x}%`}
                y={height - 20 - barH}
                width={`${barW}%`}
                height={barH}
                fill={barColor}
                opacity={0.85}
                rx={1}
              />
            </g>
          );
        })}
      </svg>
      {/* Labels */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between" }}>
        {data.map((bar, i) => (
          <div key={i} style={{ width: `${barW}%`, textAlign: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 9, display: "block", lineHeight: "14px" }}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>
      {/* Value tooltips on hover handled by title */}
    </div>
  );
}
