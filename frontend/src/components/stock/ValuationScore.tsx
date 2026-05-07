"use client";

import { useEffect, useState } from "react";
import { api, type Ratios } from "@/lib/api";

interface ValuationScoreProps {
  ticker: string;
}

interface ScoreResult {
  score: number | null;
  label: string;
  color: string;
}

function computeScore(r: Ratios): ScoreResult {
  // Need at least one of P/E, P/B, EV/EBITDA to produce a meaningful score
  const hasCore =
    (r.pe != null && r.pe > 0) ||
    (r.pb != null && r.pb > 0) ||
    (r.evEbitda != null && r.evEbitda > 0);

  if (!hasCore) {
    return { score: null, label: "Veri Yetersiz", color: "var(--text-muted)" };
  }

  let score = 0;

  if (r.pe != null && r.pe > 0) score += Math.min(r.pe / 50, 1) * 25;
  if (r.pb != null && r.pb > 0) score += Math.min(r.pb / 6, 1) * 20;
  if (r.evEbitda != null && r.evEbitda > 0) score += Math.min(r.evEbitda / 30, 1) * 20;
  if (r.ps != null && r.ps > 0) score += Math.min(r.ps / 8, 1) * 15;
  if (r.debtToEquity != null && r.debtToEquity > 100) score += Math.min((r.debtToEquity - 100) / 200, 1) * 5;

  if (r.netMargin != null && r.netMargin > 0) score -= r.netMargin * 30;
  if (r.grossMargin != null && r.grossMargin > 0.4) score -= 5;
  if (r.revenueGrowth != null && r.revenueGrowth > 0) score -= Math.min(r.revenueGrowth, 0.5) * 16;
  if (r.roe != null && r.roe > 0) score -= Math.min(r.roe, 0.4) * 10;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Cazip";
  let color = "var(--up)";
  if (finalScore >= 70) { label = "Çok Pahalı"; color = "#ef4444"; }
  else if (finalScore >= 50) { label = "Pahalı"; color = "#f97316"; }
  else if (finalScore >= 30) { label = "Makul"; color = "#eab308"; }

  return { score: finalScore, label, color };
}

export function ValuationScore({ ticker }: ValuationScoreProps) {
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.ratios(ticker).then(setRatios).catch(console.error).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5 animate-pulse h-[180px]" />
    );
  }

  if (!ratios) return null;

  const { score, label, color } = computeScore(ratios);

  // Insufficient data state
  if (score === null) {
    return (
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl p-6 text-center">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mb-1">Pahalılık Skoru</p>
        <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Bu hisse için değerleme verisi yetersiz.</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
      {/* Header */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-5 py-3 flex items-center justify-between">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Pahalılık Skoru</p>
        <div className="text-right">
          <p style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1 }} className="tabular-nums">{score}</p>
          <p style={{ color }} className="text-[12px] font-medium mt-0.5">{label}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 py-4">
        <div className="relative h-3 rounded-full overflow-hidden mb-1" style={{ background: "var(--bg-tertiary)" }}>
          <div className="absolute inset-0 rounded-full" style={{
            background: "linear-gradient(to right, var(--up), #eab308, #f97316, #ef4444)"
          }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md rounded-full transition-all"
            style={{ left: `${score}%`, transform: "translateX(-50%)" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {["Cazip", "Makul", "Pahalı", "Çok Pahalı"].map((l) => (
            <span key={l} style={{ color: "var(--text-muted)" }} className="text-[10px]">{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
