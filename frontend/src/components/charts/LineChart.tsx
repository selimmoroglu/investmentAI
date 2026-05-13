"use client";

import { useRef, useState } from "react";

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

export function LineChart({ data, color = "var(--chart-gold)", height = 200, formatY, unit = "" }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ idx: number; cx: number; cy: number } | null>(null);

  if (data.length < 2) return null;

  const vals = data.map((d) => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  // pad y range for visual breathing room
  const yMin = minV - range * 0.08;
  const yMax = maxV + range * 0.08;
  const yRange = yMax - yMin;

  const W = 600;
  const H = height - 32;
  const padL = 52;
  const padR = 12;
  const padT = 14;
  const plotBottom = padT + (H - padT);

  const toX = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const toY = (v: number) => padT + (1 - (v - yMin) / yRange) * (H - padT);

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${plotBottom.toFixed(1)} L${points[0].x.toFixed(1)},${plotBottom.toFixed(1)} Z`;

  const fmt = formatY || ((v: number) => v.toFixed(1) + unit);

  // Y-axis grid (4 yatay çizgi)
  const gridSteps = 4;
  const gridVals = Array.from({ length: gridSteps + 1 }, (_, i) => yMin + (yRange * i) / gridSteps);

  // Smart x-label sampling — yaklaşık 6-8 etiket
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - xRel);
      if (d < bestDist) { bestDist = d; closest = i; }
    }
    setHover({ idx: closest, cx: points[closest].x, cy: points[closest].y });
  }

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y grid + labels */}
        {gridVals.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line
                x1={padL} y1={y} x2={W - padR} y2={y}
                stroke="var(--border)" strokeWidth="0.5"
                strokeDasharray={i === 0 || i === gridSteps ? "0" : "3,3"}
                opacity={0.6}
              />
              <text x={padL - 6} y={y + 3.5} fill="var(--text-muted)" fontSize={9.5} textAnchor="end">
                {fmt(v)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={color} opacity={0.08} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover?.idx === i ? 4.5 : 2.4} fill={color} stroke="var(--bg-card)" strokeWidth={1.5} />
        ))}

        {/* Crosshair */}
        {hover && (
          <g>
            <line
              x1={hover.cx} y1={padT} x2={hover.cx} y2={plotBottom}
              stroke="var(--text-muted)" strokeWidth="0.8" strokeDasharray="3,3" opacity={0.5}
            />
            <circle cx={hover.cx} cy={hover.cy} r={5.5} fill={color} stroke="var(--bg-card)" strokeWidth={2} />
          </g>
        )}

        {/* X labels (sample) */}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={toX(i)}
              y={height - 8}
              fill="var(--text-muted)"
              fontSize={9}
              textAnchor="middle"
            >
              {d.label}
            </text>
          );
        })}
      </svg>

      {/* Tooltip box */}
      {hover && (
        <div
          style={{
            position: "absolute",
            left: `${(hover.cx / W) * 100}%`,
            top: 4,
            transform: hover.cx > W / 2 ? "translate(calc(-100% - 10px), 0)" : "translate(10px, 0)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            zIndex: 10,
            animation: "fade-in 120ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.2 }} className="tabular-nums uppercase tracking-wider font-medium">
            {data[hover.idx].label}
          </p>
          <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginTop: 2 }} className="tabular-nums">
            {fmt(data[hover.idx].value)}
          </p>
        </div>
      )}
    </div>
  );
}
