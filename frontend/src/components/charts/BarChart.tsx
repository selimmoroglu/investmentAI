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
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(1)}`;
}

export function BarChart({ data, color = "var(--chart-blue)", height = 160, formatValue = fmtShort }: BarChartProps) {
  if (!data.length) return null;

  const W = 480;
  const padL = 6;
  const padR = 6;
  const padTop = 28;
  const padBottom = 22;
  const chartH = height - padTop - padBottom;

  const max = Math.max(...data.map((d) => Math.abs(d.value)));
  const hasNeg = data.some((d) => d.value < 0);

  const gap = 4;
  const totalW = W - padL - padR;
  const barW = (totalW - gap * (data.length - 1)) / data.length;

  const toX = (i: number) => padL + i * (barW + gap);
  const toBarH = (v: number) => max === 0 ? 0 : (Math.abs(v) / max) * chartH * 0.9;

  // Zero line y: if all positive, zero is bottom; if mixed, zero is at midpoint
  const zeroY = hasNeg
    ? padTop + chartH / 2
    : padTop + chartH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} style={{ display: "block" }}>
      {/* Zero line */}
      <line
        x1={padL} y1={zeroY} x2={W - padR} y2={zeroY}
        stroke="var(--border)" strokeWidth="0.8"
      />

      {data.map((bar, i) => {
        const bH = toBarH(bar.value);
        const isNeg = bar.value < 0;
        const barColor = isNeg ? "var(--down)" : color;
        const x = toX(i);
        const y = isNeg ? zeroY : zeroY - bH;

        const labelY = isNeg ? zeroY + bH + 10 : zeroY - bH - 6;
        const labelColor = isNeg ? "var(--down)" : "var(--text-secondary)";

        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={Math.max(bH, 1)}
              fill={barColor}
              opacity={0.85}
              rx={2}
            />
            {/* Value label */}
            <text
              x={x + barW / 2} y={labelY}
              textAnchor="middle"
              fill={labelColor}
              fontSize={9}
              fontWeight="500"
            >
              {formatValue(bar.value)}
            </text>
            {/* X label */}
            <text
              x={x + barW / 2}
              y={height - 4}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={9}
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
