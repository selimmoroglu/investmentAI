"use client";

import { useEffect, useState } from "react";
import { api, type QualityAnalysis } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { Check, X, Shield, AlertTriangle, TrendingUp } from "lucide-react";

interface Props {
  ticker: string;
}

const VERDICT_TONE_MAP: Record<string, "up" | "down" | "warn" | "neutral"> = {
  up: "up",
  down: "down",
  warn: "warn",
  neutral: "neutral",
};

export function QualityScoresCard({ ticker }: Props) {
  const [data, setData] = useState<QualityAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.quality(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return <Skeleton height="280px" />;
  }

  if (!data || (!data.piotroski && !data.altman)) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-muted)" }} className="text-[13px] text-center py-6">
          Bu hisse için kalite & risk skorları hesaplanamadı (yfinance finansal veri yetersiz).
        </p>
      </Card>
    );
  }

  const pio = data.piotroski;
  const alt = data.altman;
  const verdictTone = VERDICT_TONE_MAP[data.longTermColor] || "neutral";

  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      {/* Header — overall verdict */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 20px",
        }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              background:
                verdictTone === "up" ? "var(--up-bg)" :
                verdictTone === "down" ? "var(--down-bg)" :
                verdictTone === "warn" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-tertiary)",
              color:
                verdictTone === "up" ? "var(--up)" :
                verdictTone === "down" ? "var(--down)" :
                verdictTone === "warn" ? "#f59e0b" : "var(--text-secondary)",
              width: 36, height: 36,
            }}
            className="rounded-full flex items-center justify-center shrink-0"
          >
            {verdictTone === "up" ? <TrendingUp size={18} strokeWidth={2.2} /> :
             verdictTone === "down" ? <AlertTriangle size={18} strokeWidth={2.2} /> :
             <Shield size={18} strokeWidth={2.2} />}
          </div>
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Uzun Vade Kalite & Risk</p>
            <p style={{ color: "var(--text-primary)" }} className="text-[15px] font-bold mt-0.5">{data.longTermVerdict}</p>
          </div>
        </div>

        <button
          onClick={() => setShowBreakdown((v) => !v)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
          className="text-[11px] font-medium px-3 py-1.5 rounded-md hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
        >
          {showBreakdown ? "Detayları Gizle" : "Detayları Göster"}
        </button>
      </div>

      {/* Body — two columns: Piotroski + Altman */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: "var(--border)" }}>
        {/* Piotroski */}
        {pio && (
          <div className="p-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Piotroski F-Score</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] mt-0.5">Finansal sağlık (9 kriter)</p>
              </div>
              <Badge tone={pio.verdictColor === "up" ? "up" : pio.verdictColor === "down" ? "down" : pio.verdictColor === "warn" ? "warn" : "neutral"} size="md">
                {pio.verdict}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span
                style={{
                  color: pio.score >= 7 ? "var(--up)" : pio.score >= 5 ? "var(--text-primary)" : pio.score >= 3 ? "#f59e0b" : "var(--down)",
                  fontSize: 36,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                className="tabular-nums"
              >
                {pio.score}
              </span>
              <span style={{ color: "var(--text-muted)" }} className="text-[14px] font-medium">/ {pio.maxScore}</span>
            </div>

            {/* Progress bar — segmented */}
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: 9 }).map((_, i) => {
                const passed = pio.breakdown[i]?.passed === true;
                const skipped = pio.breakdown[i]?.skipped === true;
                return (
                  <div
                    key={i}
                    style={{
                      background: skipped ? "var(--bg-tertiary)" :
                                  passed ? "var(--up)" : "var(--bg-tertiary)",
                      opacity: skipped ? 0.4 : passed ? 1 : 0.5,
                      height: 4,
                      flex: 1,
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>

            {showBreakdown && (
              <ul className="space-y-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                {pio.breakdown.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: c.skipped ? "var(--text-muted)" : "var(--text-secondary)" }}>
                    {c.skipped ? (
                      <span style={{ color: "var(--text-muted)" }} className="text-[14px] leading-none">−</span>
                    ) : c.passed ? (
                      <Check size={13} strokeWidth={2.5} color="var(--up)" className="mt-0.5 shrink-0" />
                    ) : (
                      <X size={13} strokeWidth={2.5} color="var(--down)" className="mt-0.5 shrink-0" />
                    )}
                    <span>{c.label}{c.skipped ? " (veri yok)" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Altman */}
        {alt && (
          <div className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Altman Z-Score</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] mt-0.5">İflas riski (3 bölge)</p>
              </div>
              <Badge tone={alt.zoneColor} size="md">{alt.zone}</Badge>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span
                style={{
                  color: alt.zoneColor === "up" ? "var(--up)" : alt.zoneColor === "down" ? "var(--down)" : "#f59e0b",
                  fontSize: 36,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                className="tabular-nums"
              >
                {alt.score.toFixed(2)}
              </span>
            </div>

            {/* Zone scale */}
            <div className="relative h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--bg-tertiary)" }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: "linear-gradient(to right, var(--down) 0%, var(--down) 30%, #f59e0b 30%, #f59e0b 60%, var(--up) 60%, var(--up) 100%)" }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md rounded-full"
                style={{ left: `${Math.min(Math.max(alt.score / 5, 0), 1) * 100}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">Riskli (&lt;1.81)</span>
              <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">Gri</span>
              <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">Güvenli (&gt;2.99)</span>
            </div>

            <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px] mt-3 leading-relaxed">
              {alt.zoneDescription}
            </p>

            {showBreakdown && (
              <ul className="space-y-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                {alt.breakdown.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-[11.5px]">
                    <span style={{ color: "var(--text-secondary)" }} className="flex-1">
                      <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{p.coef}×</span> {p.label}
                    </span>
                    <span style={{ color: "var(--text-primary)" }} className="font-medium tabular-nums">
                      {p.weighted != null ? p.weighted.toFixed(2) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
