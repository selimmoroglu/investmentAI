"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, AlertTriangle, BookOpen, RefreshCw } from "lucide-react";
import { api, type BalanceSheetAnalysis, type BalanceSheetSignal } from "@/lib/api";
import { Skeleton } from "@/components/ui";

interface Props {
  ticker: string;
  currency?: string | null;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function fmtBig(v: number | null | undefined, currency?: string | null): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const sym = currency === "TRY" ? "₺" : currency === "USD" ? "$" : "";
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined, showSign = true): string {
  if (v == null || !isFinite(v)) return "—";
  const s = showSign && v >= 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(1)}%`;
}

function verdictColor(c: string): string {
  if (c === "up") return "var(--up)";
  if (c === "down") return "var(--down)";
  return "var(--warn)";
}

function TrendIcon({ trend, size = 12 }: { trend: string; size?: number }) {
  if (trend === "improving") return <TrendingUp size={size} color="var(--up)" strokeWidth={2} />;
  if (trend === "declining") return <TrendingDown size={size} color="var(--down)" strokeWidth={2} />;
  return <Minus size={size} color="var(--text-muted)" strokeWidth={2} />;
}

// ─── Mini Trend Çubukları ─────────────────────────────────────────────────────

function TrendBars({
  values,
  years,
  isRatio = false,
}: {
  values: (number | null)[];
  years: string[];
  isRatio?: boolean;
}) {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return <span style={{ color: "var(--text-muted)" }} className="text-[11px]">Veri yok</span>;

  const minV = Math.min(...valid);
  const maxV = Math.max(...valid);
  const range = maxV - minV || 1;

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 36 }}>
      {values.slice(0, 4).reverse().map((v, i) => {
        const idx = values.length - 1 - i;
        const isLast = i === values.length - 1;
        const height = v != null ? Math.max(4, ((v - minV) / range) * 28 + 4) : 4;
        const isUp = v != null && v >= 0;
        const barColor = isRatio
          ? (v != null && v <= 0.5 ? "var(--up)" : v != null && v <= 1.5 ? "var(--warn)" : "var(--down)")
          : (isUp ? "var(--up)" : "var(--down)");
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              style={{
                width: 14,
                height,
                background: isLast ? "var(--accent-primary)" : barColor,
                borderRadius: "2px 2px 0 0",
                opacity: isLast ? 1 : 0.65,
                transition: "height 0.4s ease",
              }}
              title={v != null ? (isRatio ? `${v.toFixed(2)}x` : fmtPct(v)) : "—"}
            />
            {years[idx] && (
              <span style={{ color: "var(--text-muted)", fontSize: 9 }} className="leading-none">
                {years[idx].slice(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Revenue Çubukları ────────────────────────────────────────────────────────

function RevBars({ values, years, currency }: { values: (number | null)[]; years: string[]; currency: string }) {
  const valid = values.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return <span style={{ color: "var(--text-muted)" }} className="text-[11px]">Veri yok</span>;
  const maxV = Math.max(...valid);

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 36 }}>
      {values.slice(0, 4).reverse().map((v, i) => {
        const idx = values.length - 1 - i;
        const isLast = i === values.length - 1;
        const height = v != null && v > 0 ? Math.max(4, (v / maxV) * 30) : 4;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              style={{
                width: 14, height,
                background: isLast ? "var(--accent-primary)" : "var(--up)",
                borderRadius: "2px 2px 0 0",
                opacity: isLast ? 1 : 0.55,
              }}
              title={v != null ? fmtBig(v, currency) : "—"}
            />
            {years[idx] && (
              <span style={{ color: "var(--text-muted)", fontSize: 9 }} className="leading-none">
                {years[idx].slice(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sinyal Satırı ────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: BalanceSheetSignal }) {
  const isPos = signal.type === "positive";
  const isNeg = signal.type === "negative";
  const Icon = isPos ? CheckCircle2 : isNeg ? XCircle : AlertTriangle;
  const color = isPos ? "var(--up)" : isNeg ? "var(--down)" : "var(--warn)";
  const bg = isPos ? "var(--up-bg)" : isNeg ? "var(--down-bg)" : "rgba(245,158,11,0.08)";

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={11} color={color} strokeWidth={2.5} />
      </div>
      <span style={{ color: "var(--text-secondary)", lineHeight: 1.4 }} className="text-[12px]">{signal.text}</span>
    </div>
  );
}

// ─── Ana Kart ─────────────────────────────────────────────────────────────────

export function BalanceSheetAnalysisCard({ ticker, currency }: Props) {
  const [data, setData] = useState<BalanceSheetAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const d = await api.balanceSheetAnalysis(ticker);
      if ("error" in d) throw new Error(String((d as { error: string }).error));
      setData(d);
    } catch {
      setError("Bilanço verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ticker]);

  const cur = currency ?? data?.currency ?? "USD";

  if (loading) return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 space-y-4">
      <Skeleton height="20px" width="200px" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} height="80px" />)}
      </div>
      <Skeleton height="60px" />
      <Skeleton height="100px" />
    </div>
  );

  if (error || !data) return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen size={15} color="var(--text-muted)" strokeWidth={1.8} />
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Bilanço Analizi</p>
      </div>
      <p style={{ color: "var(--text-muted)" }} className="text-[12px]">{error || "Veri yok."}</p>
      <button onClick={load} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer", marginTop: 12 }}
        className="flex items-center gap-1.5">
        <RefreshCw size={11} strokeWidth={2} /> Tekrar Dene
      </button>
    </div>
  );

  const vc = verdictColor(data.longTermVerdictColor);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
      {/* Header */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={14} color="var(--accent-primary)" strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold leading-tight">Bilanço Analizi</p>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px]">Son {data.years.length} yıllık finansal trend</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.isFinancial && (
            <span style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent-primary)", borderRadius: 6, fontSize: 10, fontWeight: 600, padding: "2px 8px" }}>
              Finansal Şirket
            </span>
          )}
          <span style={{ background: data.longTermVerdictColor === "up" ? "var(--up-bg)" : data.longTermVerdictColor === "down" ? "var(--down-bg)" : "rgba(245,158,11,0.08)", color: vc, borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "4px 12px" }}>
            {data.longTermVerdict}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Trend Metrik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Gelir Büyümesi */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Gelir CAGR</p>
              <TrendIcon trend={data.revenueGrowthTrend} />
            </div>
            <p style={{ color: data.revenueCagr != null && data.revenueCagr >= 0 ? "var(--up)" : "var(--down)", fontSize: 20, fontWeight: 800 }} className="tabular-nums leading-tight">
              {data.revenueCagr != null ? `${data.revenueCagr >= 0 ? "+" : ""}${(data.revenueCagr * 100).toFixed(0)}%` : "—"}
            </p>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">
              YoY: {fmtPct(data.revenueGrowthLastYear)}
            </p>
            <div className="mt-2">
              <RevBars values={data.revenueValues} years={data.years} currency={cur} />
            </div>
          </div>

          {/* Net Kar Marjı */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Net Marj</p>
              <TrendIcon trend={data.netMarginTrend} />
            </div>
            <p style={{ color: data.currentNetMargin != null && data.currentNetMargin >= 0 ? "var(--text-primary)" : "var(--down)", fontSize: 20, fontWeight: 800 }} className="tabular-nums leading-tight">
              {data.currentNetMargin != null ? `${(data.currentNetMargin * 100).toFixed(1)}%` : "—"}
            </p>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">
              Brüt: {data.currentGrossMargin != null ? `${(data.currentGrossMargin * 100).toFixed(1)}%` : "—"}
            </p>
            <div className="mt-2">
              <TrendBars values={data.netMarginValues} years={data.years} />
            </div>
          </div>

          {/* Borç / Özsermaye */}
          {!data.isFinancial ? (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Borç/Özsermaye</p>
                {data.debtToEquityTrend === "decreasing"
                  ? <TrendingDown size={12} color="var(--up)" strokeWidth={2} />
                  : data.debtToEquityTrend === "increasing"
                  ? <TrendingUp size={12} color="var(--down)" strokeWidth={2} />
                  : <Minus size={12} color="var(--text-muted)" strokeWidth={2} />}
              </div>
              <p style={{
                color: data.currentDebtToEquity != null
                  ? (data.currentDebtToEquity <= 0.5 ? "var(--up)" : data.currentDebtToEquity <= 1.5 ? "var(--warn)" : "var(--down)")
                  : "var(--text-muted)",
                fontSize: 20, fontWeight: 800,
              }} className="tabular-nums leading-tight">
                {data.currentDebtToEquity != null ? `${data.currentDebtToEquity.toFixed(1)}x` : "—"}
              </p>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">
                {data.debtToEquityTrend === "decreasing" ? "azalıyor ↓" : data.debtToEquityTrend === "increasing" ? "artıyor ↑" : "sabit —"}
              </p>
              <div className="mt-2">
                <TrendBars values={data.debtToEquityValues} years={data.years} isRatio />
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">ROE</p>
                <TrendIcon trend="stable" />
              </div>
              <p style={{ color: data.roe != null && data.roe >= 0.12 ? "var(--up)" : data.roe != null && data.roe >= 0 ? "var(--warn)" : "var(--down)", fontSize: 20, fontWeight: 800 }} className="tabular-nums leading-tight">
                {data.roe != null ? `${(data.roe * 100).toFixed(1)}%` : "—"}
              </p>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">
                ROA: {data.roa != null ? `${(data.roa * 100).toFixed(2)}%` : "—"}
              </p>
            </div>
          )}

          {/* FCF */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Serbest NK</p>
              <TrendIcon trend={data.fcfTrend} />
            </div>
            <p style={{ color: data.currentFcf != null && data.currentFcf >= 0 ? "var(--up)" : "var(--down)", fontSize: 20, fontWeight: 800 }} className="tabular-nums leading-tight">
              {fmtBig(data.currentFcf, cur)}
            </p>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">
              {data.fcfTrend === "improving" ? "güçleniyor ↑" : data.fcfTrend === "declining" ? "zayıflıyor ↓" : "sabit —"}
            </p>
            <div className="mt-2">
              <RevBars values={data.fcfValues} years={data.years} currency={cur} />
            </div>
          </div>
        </div>

        {/* Sinyaller */}
        {data.signals.length > 0 && (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }} className="p-4">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-2">Temel Sinyaller</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              {data.signals.map((sig, i) => <SignalRow key={i} signal={sig} />)}
            </div>
          </div>
        )}

        {/* Uzun Vade Yorum */}
        {data.commentary && (
          <div style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${vc} 5%, var(--bg-secondary)), var(--bg-secondary))`, border: `1px solid color-mix(in srgb, ${vc} 20%, var(--border))`, borderRadius: 12 }} className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: vc, flexShrink: 0 }} />
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Uzun Vade Değerlendirme</p>
              <span style={{ color: vc, fontSize: 10, fontWeight: 700, marginLeft: "auto" }}>
                {data.verdictScore}/100
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }} className="text-[12.5px]">
              {data.commentary}
            </p>
          </div>
        )}

        {/* Piotroski & ROE/ROA küçük bilgi çubuğu */}
        <div className="flex flex-wrap gap-2">
          {data.piotroskiScore != null && (
            <span style={{
              background: data.piotroskiScore >= 7 ? "var(--up-bg)" : data.piotroskiScore >= 4 ? "rgba(245,158,11,0.08)" : "var(--down-bg)",
              color: data.piotroskiScore >= 7 ? "var(--up)" : data.piotroskiScore >= 4 ? "var(--warn)" : "var(--down)",
              borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "3px 10px",
            }}>
              Piotroski: {data.piotroskiScore}/9
            </span>
          )}
          {data.roe != null && !data.isFinancial && (
            <span style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", borderRadius: 6, fontSize: 11, fontWeight: 500, padding: "3px 10px" }}>
              ROE: {(data.roe * 100).toFixed(1)}%
            </span>
          )}
          {data.roa != null && (
            <span style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", borderRadius: 6, fontSize: 11, fontWeight: 500, padding: "3px 10px" }}>
              ROA: {(data.roa * 100).toFixed(2)}%
            </span>
          )}
          {data.years.length > 0 && (
            <span style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", borderRadius: 6, fontSize: 10, fontWeight: 500, padding: "3px 10px", marginLeft: "auto" }}>
              {data.years[data.years.length - 1]}–{data.years[0]} verileri
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
