"use client";

import { useEffect, useState } from "react";
import { api, type Ratios } from "@/lib/api";

interface ValuationScoreProps {
  ticker: string;
}

interface ScoreComponent {
  label: string;
  contribution: number;
  detail: string;
  positive: boolean;
}

function computeScore(r: Ratios): { score: number; components: ScoreComponent[]; label: string; color: string } {
  const components: ScoreComponent[] = [];
  let score = 0;

  // P/E contribution (0-30 points → pahalı)
  if (r.pe != null && r.pe > 0) {
    const c = Math.min(r.pe / 50, 1) * 30;
    score += c;
    components.push({
      label: "F/K Oranı",
      contribution: c,
      detail: `${r.pe.toFixed(1)}x — ${r.pe < 12 ? "Düşük (cazip)" : r.pe < 25 ? "Makul" : r.pe < 40 ? "Yüksek" : "Çok yüksek"}`,
      positive: r.pe < 20,
    });
  }

  // P/B contribution (0-20 points)
  if (r.pb != null && r.pb > 0) {
    const c = Math.min(r.pb / 6, 1) * 20;
    score += c;
    components.push({
      label: "PD/DD (P/B)",
      contribution: c,
      detail: `${r.pb.toFixed(2)}x — ${r.pb < 1.5 ? "Defter değeri yakını" : r.pb < 3 ? "Makul" : "Defter değerinin üstü"}`,
      positive: r.pb < 2,
    });
  }

  // EV/EBITDA contribution (0-20 points)
  if (r.evEbitda != null && r.evEbitda > 0) {
    const c = Math.min(r.evEbitda / 30, 1) * 20;
    score += c;
    components.push({
      label: "FD/FAVÖK",
      contribution: c,
      detail: `${r.evEbitda.toFixed(1)}x — ${r.evEbitda < 8 ? "Ucuz" : r.evEbitda < 15 ? "Makul" : "Pahalı"}`,
      positive: r.evEbitda < 12,
    });
  }

  // Net margin bonus (reduces pahalılık — iyi şirket haklı)
  if (r.netMargin != null && r.netMargin > 0) {
    const bonus = r.netMargin * 30;
    score -= bonus;
    components.push({
      label: "Net Kar Marjı",
      contribution: -bonus,
      detail: `%${(r.netMargin * 100).toFixed(1)} — kaliteli kazanç fiyatı destekliyor`,
      positive: true,
    });
  }

  // Revenue growth bonus
  if (r.revenueGrowth != null && r.revenueGrowth > 0) {
    const bonus = Math.min(r.revenueGrowth, 0.5) * 16;
    score -= bonus;
    components.push({
      label: "Gelir Büyümesi",
      contribution: -bonus,
      detail: `%${(r.revenueGrowth * 100).toFixed(1)} YoY — büyüme fiyatı haklı kılıyor`,
      positive: true,
    });
  }

  // ROE bonus
  if (r.roe != null && r.roe > 0) {
    const bonus = Math.min(r.roe, 0.4) * 10;
    score -= bonus;
    components.push({
      label: "Özsermaye Karlılığı (ROE)",
      contribution: -bonus,
      detail: `%${(r.roe * 100).toFixed(1)} — yüksek ROE pahalılığı hafifletiyor`,
      positive: true,
    });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Ucuz";
  let color = "var(--up)";
  if (finalScore >= 70) { label = "Çok Pahalı"; color = "#ef4444"; }
  else if (finalScore >= 50) { label = "Pahalı"; color = "#f97316"; }
  else if (finalScore >= 30) { label = "Makul"; color = "#eab308"; }
  else { label = "Cazip"; color = "var(--up)"; }

  return { score: finalScore, components, label, color };
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

  const { score, components, label, color } = computeScore(ratios);

  return (
    <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
      {/* Header */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-5 py-3 flex items-center justify-between">
        <div>
          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Pahalılık Skoru</p>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">F/K, PD/DD, marjlar ve büyüme baz alınarak hesaplanır</p>
        </div>
        <div className="text-right">
          <p style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1 }} className="tabular-nums">{score}</p>
          <p style={{ color }} className="text-[12px] font-medium mt-0.5">{label}</p>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ background: "var(--bg-card)" }} className="px-5 py-4">
        <div className="relative h-3 rounded-full overflow-hidden mb-1" style={{ background: "var(--bg-tertiary)" }}>
          {/* Gradient track */}
          <div className="absolute inset-0 rounded-full" style={{
            background: "linear-gradient(to right, var(--up), #eab308, #f97316, #ef4444)"
          }} />
          {/* Indicator */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md rounded-full transition-all"
            style={{ left: `${score}%`, transform: "translateX(-50%)" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {["Cazip", "Makul", "Pahalı", "Çok Pahalı"].map((l) => (
            <span key={l} style={{ color: "var(--text-muted)" }} className="text-[10px]">{l}</span>
          ))}
        </div>

        {/* Components */}
        <div className="mt-4 space-y-2.5">
          {components.map((c) => (
            <div key={c.label} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p style={{ color: "var(--text-secondary)" }} className="text-[12px] font-medium">{c.label}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{c.detail}</p>
              </div>
              <span
                style={{ color: c.positive ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}
                className="text-[12px] font-medium tabular-nums shrink-0"
              >
                {c.contribution >= 0 ? "+" : ""}{c.contribution.toFixed(1)} puan
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
