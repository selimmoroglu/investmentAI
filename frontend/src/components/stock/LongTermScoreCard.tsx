"use client";

import { useEffect, useState } from "react";
import { api, type CompositeScore } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";

interface Props {
  ticker: string;
}

const CATEGORY_LABELS: Record<keyof CompositeScore["breakdown"], string> = {
  quality: "Kalite",
  value: "Değer",
  growth: "Büyüme",
  yield: "Temettü",
};

const CATEGORY_COLORS: Record<keyof CompositeScore["breakdown"], string> = {
  quality: "var(--accent-primary)",
  value: "var(--up)",
  growth: "var(--chart-gold)",
  yield: "var(--chart-pink)",
};

export function LongTermScoreCard({ ticker }: Props) {
  const [data, setData] = useState<CompositeScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.composite(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <Skeleton height="320px" />;
  if (!data) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-muted)" }} className="text-[13px] text-center py-6">Composite skor hesaplanamadı.</p>
      </Card>
    );
  }

  const cats = Object.keys(data.breakdown) as (keyof CompositeScore["breakdown"])[];

  return (
    <Card variant="elevated" padding="lg" className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Uzun Vade Skoru</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-[11px] mt-0.5">
            Kalite (40%) + Değer (30%) + Büyüme (20%) + Temettü (10%)
          </p>
        </div>
        <Badge tone={data.verdictColor} size="md">{data.verdict}</Badge>
      </div>

      {/* Big score circle */}
      <div className="flex items-center gap-6">
        <CircularScore score={data.score} color={
          data.score >= 60 ? "var(--up)" :
          data.score >= 45 ? "#f59e0b" : "var(--down)"
        } />

        <div className="flex-1 space-y-2.5">
          {cats.map((cat) => {
            const v = data.breakdown[cat];
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: "var(--text-secondary)" }} className="text-[11.5px] font-medium">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold tabular-nums">
                    {v.toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                  <div
                    style={{
                      width: `${v}%`,
                      height: "100%",
                      background: CATEGORY_COLORS[cat],
                      transition: "width var(--transition-base)",
                    }}
                    className="rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ color: "var(--text-muted)" }} className="text-[10px] leading-relaxed pt-2">
        <strong style={{ color: "var(--text-secondary)" }}>Yorum:</strong>{" "}
        {data.score >= 75 && "Tüm boyutlarda güçlü — uzun vadeli portföy adayı."}
        {data.score >= 60 && data.score < 75 && "Çoğu boyutta iyi — uzun vade için cazip."}
        {data.score >= 45 && data.score < 60 && "Karışık sinyaller — bireysel boyutları detaylı incele."}
        {data.score >= 30 && data.score < 45 && "Bazı boyutlarda zayıf — risk/fiyat dengesi dikkatli."}
        {data.score < 30 && "Birden çok boyutta zayıf — kısa vade dışında uygun değil."}
      </p>
    </Card>
  );
}

function CircularScore({ score, color }: { score: number; color: string }) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - score / 100);
  return (
    <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} stroke="var(--bg-tertiary)" strokeWidth="8" fill="none" />
        <circle
          cx="55" cy="55" r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset var(--transition-slow)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1 }} className="tabular-nums">
          {score.toFixed(0)}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 9, fontWeight: 500 }} className="uppercase tracking-wider mt-0.5">/ 100</span>
      </div>
    </div>
  );
}
