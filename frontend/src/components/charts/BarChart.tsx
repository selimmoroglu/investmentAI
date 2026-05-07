"use client";

import { useState } from "react";

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
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(1)}`;
}

export function BarChart({ data, color = "var(--chart-blue)", height = 180, formatValue = fmtShort }: BarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data.length) return null;

  const W = 520;
  const padL = 8;
  const padR = 8;
  const padTop = 30;
  const padBottom = 26;
  const chartH = height - padTop - padBottom;

  const max = Math.max(...data.map((d) => Math.abs(d.value)));
  const hasNeg = data.some((d) => d.value < 0);

  const gap = 6;
  const totalW = W - padL - padR;
  const barW = (totalW - gap * (data.length - 1)) / data.length;

  const toX = (i: number) => padL + i * (barW + gap);
  const toBarH = (v: number) => max === 0 ? 0 : (Math.abs(v) / max) * chartH * 0.9;

  // Zero line: ortada (negatifler varsa) veya altta
  const zeroY = hasNeg ? padTop + chartH / 2 : padTop + chartH;

  // Grid lines (3 satır: 0, ±max/2, ±max)
  const gridLines: { y: number; v: number }[] = [];
  if (hasNeg) {
    gridLines.push({ y: padTop, v: max });
    gridLines.push({ y: zeroY, v: 0 });
    gridLines.push({ y: padTop + chartH, v: -max });
  } else {
    gridLines.push({ y: padTop, v: max });
    gridLines.push({ y: padTop + chartH * 0.5, v: max * 0.5 });
    gridLines.push({ y: zeroY, v: 0 });
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${height}`}
        style={{ display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={padL} y1={g.y} x2={W - padR} y2={g.y}
            stroke="var(--border)"
            strokeWidth="0.6"
            strokeDasharray={g.v === 0 ? "0" : "3,3"}
            opacity={g.v === 0 ? 1 : 0.6}
          />
        ))}

        {data.map((bar, i) => {
          const bH = toBarH(bar.value);
          const isNeg = bar.value < 0;
          const barColor = isNeg ? "var(--down)" : color;
          const x = toX(i);
          const y = isNeg ? zeroY : zeroY - bH;
          const isHover = hoverIdx === i;

          const labelY = isNeg ? zeroY + bH + 11 : zeroY - bH - 7;
          const labelColor = isNeg ? "var(--down)" : "var(--text-primary)";

          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)}>
              {/* Hover hit area (full column) */}
              <rect
                x={x - gap / 2}
                y={padTop}
                width={barW + gap}
                height={chartH}
                fill="transparent"
              />
              <rect
                x={x} y={y}
                width={barW}
                height={Math.max(bH, 1)}
                fill={barColor}
                opacity={isHover ? 1 : 0.85}
                rx={2}
              />
              {/* Value label */}
              <text
                x={x + barW / 2} y={labelY}
                textAnchor="middle"
                fill={labelColor}
                fontSize={10}
                fontWeight={isHover ? "600" : "500"}
              >
                {formatValue(bar.value)}
              </text>
              {/* X label */}
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fill={isHover ? "var(--text-primary)" : "var(--text-muted)"}
                fontSize={9.5}
                fontWeight={isHover ? "600" : "400"}
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
