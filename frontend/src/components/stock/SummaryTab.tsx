"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api, type Quote, type FinancialStatement, type OHLCVBar, type RealReturn } from "@/lib/api";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ValuationScore } from "./ValuationScore";
import { QualityScoresCard } from "./QualityScoresCard";
import { IntrinsicValueCard } from "./IntrinsicValueCard";
import { LongTermScoreCard } from "./LongTermScoreCard";
import { PeerComparisonCard } from "./PeerComparisonCard";
import { BalanceSheetAnalysisCard } from "./BalanceSheetAnalysisCard";
import { Card, Stat, Skeleton, Badge } from "@/components/ui";
import { formatPrice, formatVolume, formatMarketCap, formatRatio, formatPercent } from "@/lib/formatters";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart").then((m) => ({ default: m.CandlestickChart })),
  { ssr: false }
);

interface SummaryTabProps { ticker: string }
type Period = "1G" | "1H" | "1A" | "6A" | "1Y" | "5Y";
type Freq = "quarterly" | "annual";

const PERIOD_MAP: Record<Period, { period: string; interval: string }> = {
  "1G": { period: "1d", interval: "5m" },
  "1H": { period: "5d", interval: "30m" },
  "1A": { period: "1mo", interval: "1d" },
  "6A": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
};

// ─── Section (açılır kapanır ana bölüm) ───────────────────────────────────────

function Section({
  title, defaultOpen = true, badge, children,
}: {
  title: string; defaultOpen?: boolean; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px", background: "var(--bg-secondary)", cursor: "pointer", border: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{title}</span>
          {badge}
        </div>
        {open
          ? <ChevronUp size={15} color="var(--text-muted)" strokeWidth={2} />
          : <ChevronDown size={15} color="var(--text-muted)" strokeWidth={2} />}
      </button>
      {open && <div style={{ background: "var(--bg-card)", padding: 16 }}>{children}</div>}
    </div>
  );
}

// ─── SubSection (iç açılır kapanır) ──────────────────────────────────────────

function SubSection({
  title, defaultOpen = true, children,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", background: "var(--bg-tertiary)", cursor: "pointer", border: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        {open
          ? <ChevronUp size={13} color="var(--text-muted)" strokeWidth={2} />
          : <ChevronDown size={13} color="var(--text-muted)" strokeWidth={2} />}
      </button>
      {open && <div style={{ background: "var(--bg-secondary)", padding: 12 }}>{children}</div>}
    </div>
  );
}

// ─── 52H Bant Göstergesi ─────────────────────────────────────────────────────

function WeeklyRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  if (high <= low) return null;
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  const color = pct >= 70 ? "var(--down)" : pct <= 30 ? "var(--up)" : "var(--warn)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>52H Düşük</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
          <span style={{ color, fontWeight: 700, fontSize: 10 }}>{pct.toFixed(0)}%</span> konumda
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>52H Yüksek</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--bg-tertiary)", borderRadius: 4 }}>
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease", opacity: 0.35 }} />
        <div style={{ position: "absolute", left: `${pct}%`, top: -4, width: 14, height: 14, borderRadius: "50%", background: color, transform: "translateX(-50%)", border: "2.5px solid var(--bg-card)", transition: "left 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600 }} className="tabular-nums">{formatPrice(low, null)}</span>
        <span style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600 }} className="tabular-nums">{formatPrice(high, null)}</span>
      </div>
    </div>
  );
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function parseFinRow(stmt: FinancialStatement | null, keywords: string[]): (number | null)[] {
  if (!stmt) return [];
  const row = stmt.rows.find((r) =>
    keywords.some((k) => r.label.toLowerCase().includes(k.toLowerCase()))
  );
  return row?.values ?? [];
}

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

function yoyChange(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function FinRow({ label, current, previous, currency }: {
  label: string; current: number | null; previous: number | null; currency?: string | null;
}) {
  const change = yoyChange(current, previous);
  const isUp = change != null && change >= 0;
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }} className="grid grid-cols-[1fr_auto_64px] items-center gap-2 py-2 last:border-b-0">
      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }} className="tabular-nums text-right">{fmtBig(current, currency)}</span>
      <span style={{ color: change == null ? "var(--text-muted)" : isUp ? "var(--up)" : "var(--down)", fontSize: 11, fontWeight: 500 }} className="tabular-nums text-right">
        {change == null ? "—" : `${isUp ? "+" : ""}${change.toFixed(1)}%`}
      </span>
    </div>
  );
}

function toBarData(values: (number | null)[], cols: string[], limit = 8) {
  return cols.slice(0, limit).map((col, i) => ({ label: col, value: values[i] ?? 0 }))
    .filter(d => d.value !== 0).reverse();
}

function toMarginSeries(numerator: (number | null)[], denominator: (number | null)[], cols: string[], limit = 8) {
  return cols.slice(0, limit).map((col, i) => {
    const num = numerator[i]; const den = denominator[i];
    const val = num != null && den != null && den !== 0 ? (num / den) * 100 : null;
    return { label: col, value: val ?? 0 };
  }).filter(d => d.value !== 0).reverse();
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export function SummaryTab({ ticker }: SummaryTabProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [incomeQ, setIncomeQ] = useState<FinancialStatement | null>(null);
  const [incomeA, setIncomeA] = useState<FinancialStatement | null>(null);
  const [balanceA, setBalanceA] = useState<FinancialStatement | null>(null);
  const [cashflowA, setCashflowA] = useState<FinancialStatement | null>(null);
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("6A");
  const [freq, setFreq] = useState<Freq>("quarterly");
  const [realReturn, setRealReturn] = useState<RealReturn | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    setLoadingInit(true);
    setRealReturn(null);
    setCashflowA(null);
    const { period, interval } = PERIOD_MAP[selectedPeriod];
    Promise.all([
      api.quote(ticker),
      api.financials(ticker, "income", "quarterly"),
      api.financials(ticker, "income", "annual"),
      api.financials(ticker, "balance", "annual").catch(() => null),
      api.history(ticker, period, interval),
    ]).then(([q, incQ, incA, balA, hist]) => {
      setQuote(q); setIncomeQ(incQ); setIncomeA(incA);
      setBalanceA(balA); setHistory(hist);
    }).catch(console.error).finally(() => setLoadingInit(false));

    api.financials(ticker, "cashflow", "annual").then(setCashflowA).catch(() => null);
    if (ticker.toUpperCase().endsWith(".IS")) {
      api.realReturn(ticker).then(setRealReturn).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  useEffect(() => {
    if (loadingInit) return;
    setLoadingChart(true);
    const { period, interval } = PERIOD_MAP[selectedPeriod];
    api.history(ticker, period, interval)
      .then(setHistory).catch(console.error).finally(() => setLoadingChart(false));
  }, [selectedPeriod, ticker]);

  if (loadingInit) return (
    <div className="p-5 space-y-3">
      <Skeleton height="340px" />
      <Skeleton height="60px" />
      <Skeleton height="200px" />
    </div>
  );

  if (!quote) return <div className="p-5" style={{ color: "var(--text-muted)" }}>Veri alınamadı.</div>;

  // ── Veri hazırlık ────────────────────────────────────────────────────────────
  const activeIncome = freq === "quarterly" ? incomeQ : incomeA;
  const cols = activeIncome?.columns ?? [];
  const revenue = parseFinRow(activeIncome, ["Total Revenue", "Revenue"]);
  const grossProfit = parseFinRow(activeIncome, ["Gross Profit"]);
  const operatingIncome = parseFinRow(activeIncome, ["Operating Income", "Ebit"]);
  const netIncome = parseFinRow(activeIncome, ["Net Income"]);
  const ebitda = parseFinRow(activeIncome, ["EBITDA"]);

  const revenueBar = toBarData(revenue, cols, freq === "quarterly" ? 8 : 6);
  const ebitdaBar = toBarData(ebitda.length ? ebitda : operatingIncome, cols, freq === "quarterly" ? 8 : 6);
  const netIncomeBar = toBarData(netIncome, cols, freq === "quarterly" ? 8 : 6);
  const grossMarginLine = toMarginSeries(grossProfit, revenue, cols, 8);
  const opMarginLine = toMarginSeries(operatingIncome, revenue, cols, 8);
  const netMarginLine = toMarginSeries(netIncome, revenue, cols, 8);
  const hasCharts = revenueBar.length > 1;
  const hasMargins = grossMarginLine.length > 1;

  const annCols = incomeA?.columns ?? [];
  const annRevenue = parseFinRow(incomeA, ["Total Revenue", "Revenue"]);
  const annGross = parseFinRow(incomeA, ["Gross Profit"]);
  const annEbitda = parseFinRow(incomeA, ["EBITDA"]);
  const annOpInc = parseFinRow(incomeA, ["Operating Income", "Ebit"]);
  const annNet = parseFinRow(incomeA, ["Net Income"]);
  const annEps = parseFinRow(incomeA, ["Diluted EPS", "Basic EPS"]);

  const balCols = balanceA?.columns ?? [];
  const balAssets = parseFinRow(balanceA, ["Total Assets"]);
  const balLiab = parseFinRow(balanceA, ["Total Liabilities", "Total Liab"]);
  const balEquity = parseFinRow(balanceA, ["Stockholders Equity", "Total Equity"]);
  const balNetDebt = parseFinRow(balanceA, ["Net Debt"]);

  const cfCols = cashflowA?.columns ?? [];
  const cfOcf = parseFinRow(cashflowA, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]);
  const cfCapex = parseFinRow(cashflowA, ["Capital Expenditure", "Purchase Of Ppe", "Capital Expenditures"]);
  const cfFcfRow = parseFinRow(cashflowA, ["Free Cash Flow"]);
  const cfFcf = cfFcfRow.length > 0
    ? cfFcfRow
    : cfOcf.map((ocf, i) => {
        const cap = cfCapex[i];
        return ocf != null && cap != null ? ocf - Math.abs(cap) : null;
      });
  const hasCashflow = cfCols.length >= 1 && cfOcf.length >= 1 && cfOcf[0] != null;
  const hasIncomeSummary = annCols.length >= 1 && annRevenue.length >= 1 && annRevenue[0] != null;
  const hasBalanceSummary = balCols.length >= 1 && balAssets.length >= 1 && balAssets[0] != null;

  const incLatest = annCols[0]; const incPrev = annCols[1];
  const balLatest = balCols[0]; const balPrev = balCols[1];

  const qCols = (incomeQ?.columns ?? []).slice(0, 8);
  const qRevenue = parseFinRow(incomeQ, ["Total Revenue", "Revenue"]);
  const qNetIncome = parseFinRow(incomeQ, ["Net Income"]);
  const qGrossProfit = parseFinRow(incomeQ, ["Gross Profit"]);
  const qOpIncome = parseFinRow(incomeQ, ["Operating Income", "Ebit"]);
  const qEps = parseFinRow(incomeQ, ["Diluted EPS", "Basic EPS"]);
  const qNetMargin = qCols.map((_, i) => {
    const rev = qRevenue[i]; const ni = qNetIncome[i];
    return rev && rev !== 0 && ni != null ? (ni / rev) * 100 : null;
  });
  const qGrossMargin = qCols.map((_, i) => {
    const rev = qRevenue[i]; const gp = qGrossProfit[i];
    return rev && rev !== 0 && gp != null ? (gp / rev) * 100 : null;
  });
  const qYoY = (arr: (number | null)[], idx: number): number | null => {
    const curr = arr[idx]; const prev = arr[idx + 4];
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const qQoQ = (arr: (number | null)[], idx: number): number | null => {
    const curr = arr[idx]; const prev = arr[idx + 1];
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const SHOW_Q = Math.min(4, qCols.length);
  const hasQuarterly = SHOW_Q >= 2 && qRevenue.slice(0, SHOW_Q).some(v => v != null);

  const hasAnalyst = quote.targetMeanPrice != null && quote.currentPrice != null;
  const hasFCF = quote.freeCashflow != null;

  // 52H range
  const hasRange = quote.fiftyTwoWeekHigh != null && quote.fiftyTwoWeekLow != null && quote.currentPrice != null;

  return (
    <div className="p-4 space-y-3 max-w-[1100px]">

      {/* ── Fiyat Grafiği ────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 12px" }} className="flex items-center gap-1">
          {(["1G", "1H", "1A", "6A", "1Y", "5Y"] as Period[]).map((p) => (
            <button key={p} onClick={() => setSelectedPeriod(p)}
              style={{
                background: selectedPeriod === p ? "var(--accent-muted)" : "transparent",
                color: selectedPeriod === p ? "var(--accent-primary)" : "var(--text-muted)",
                border: selectedPeriod === p ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent",
                borderRadius: 6, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              }}>
              {p}
            </button>
          ))}
          {loadingChart && <span style={{ color: "var(--text-muted)", fontSize: 11 }} className="ml-2">yükleniyor…</span>}
        </div>
        {history.length > 0
          ? <CandlestickChart data={history} height={320} />
          : <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>Grafik verisi yüklenemedi.</div>
        }
      </div>

      {/* ── Piyasa Bilgileri ────────────────────────────────────────────────── */}
      <Section title="Piyasa Bilgileri" defaultOpen>
        <div className="space-y-4">

          {/* 52H Bant */}
          {hasRange && (
            <WeeklyRangeBar
              low={quote.fiftyTwoWeekLow!}
              high={quote.fiftyTwoWeekHigh!}
              current={quote.currentPrice!}
            />
          )}

          {/* Temel metrikler */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Piyasa Değeri", value: formatMarketCap(quote.marketCap, quote.currency) },
              { label: "F/K Oranı", value: formatRatio(quote.pe), note: quote.forwardPE != null ? `İleri F/K: ${formatRatio(quote.forwardPE)}` : undefined },
              { label: "Beta", value: formatRatio(quote.beta), note: quote.beta != null ? (quote.beta > 1.5 ? "Yüksek volatilite" : quote.beta < 0.5 ? "Düşük volatilite" : "Piyasaya yakın") : undefined },
              { label: "Temettü Getirisi", value: formatPercent(quote.dividendYield) },
              { label: "Sektör", value: quote.sector || "—", note: quote.industry || undefined },
              { label: "Günlük Hacim", value: formatVolume(quote.volume) },
            ].map(({ label, value, note }) => (
              <div key={label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</p>
                <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }} className="tabular-nums">{value}</p>
                {note && <p style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>{note}</p>}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Analist Konsensüsü & Nakit Akışı ───────────────────────────────── */}
      {(hasAnalyst || hasFCF) && (
        <Section title="Analist Konsensüsü & Nakit Akışı" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasAnalyst && (() => {
              const tm = quote.targetMeanPrice!; const cp = quote.currentPrice!;
              const upside = ((tm - cp) / cp) * 100; const upsideUp = upside >= 0;
              const recKey = (quote.recommendationKey || "").toLowerCase();
              const recTone: "up" | "down" | "warn" | "neutral" = recKey === "strong_buy" || recKey === "buy" ? "up" : recKey === "sell" || recKey === "strong_sell" ? "down" : "warn";
              const recLabel: Record<string, string> = { strong_buy: "Güçlü Al", buy: "Al", hold: "Tut", sell: "Sat", strong_sell: "Güçlü Sat", underperform: "Düşük Perf." };
              return (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10 }} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }} className="uppercase tracking-wider">Analist Konsensüsü</p>
                    {quote.recommendationKey && <Badge tone={recTone} size="md">{recLabel[recKey] || quote.recommendationKey}</Badge>}
                  </div>
                  <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800 }} className="tabular-nums">{formatPrice(tm, quote.currency)}</p>
                  <p style={{ color: upsideUp ? "var(--up)" : "var(--down)", fontSize: 12, fontWeight: 600, marginTop: 4 }} className="tabular-nums">
                    {upsideUp ? "+" : ""}{upside.toFixed(1)}% potansiyel · {quote.numberOfAnalystOpinions ?? "—"} analist
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <Stat label="Üst Hedef" value={formatPrice(quote.targetHighPrice, quote.currency)} size="sm" />
                    <Stat label="Alt Hedef" value={formatPrice(quote.targetLowPrice, quote.currency)} size="sm" />
                  </div>
                </div>
              );
            })()}
            {hasFCF && (() => {
              const fcf = quote.freeCashflow!;
              const fcfMargin = quote.totalRevenue ? (fcf / quote.totalRevenue) * 100 : null;
              const fcfYield = quote.marketCap ? (fcf / quote.marketCap) * 100 : null;
              return (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10 }} className="p-4">
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }} className="uppercase tracking-wider mb-3">Nakit Üretme Gücü</p>
                  <p style={{ color: fcf > 0 ? "var(--text-primary)" : "var(--down)", fontSize: 22, fontWeight: 800 }} className="tabular-nums">{formatMarketCap(fcf, quote.currency)}</p>
                  {fcfYield != null && <p style={{ color: fcfYield > 5 ? "var(--up)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>FCF Verimi: {fcfYield.toFixed(2)}%</p>}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <Stat label="FCF Marjı" value={fcfMargin != null ? `${fcfMargin.toFixed(1)}%` : "—"} size="sm" />
                    <Stat label="Net Borç" value={quote.totalDebt != null && quote.totalCash != null ? formatMarketCap(quote.totalDebt - quote.totalCash, quote.currency) : "—"} size="sm" />
                  </div>
                </div>
              );
            })()}
          </div>
        </Section>
      )}

      {/* ── Finansal Tablolar ────────────────────────────────────────────────── */}
      {(hasQuarterly || hasIncomeSummary || hasBalanceSummary) && (
        <Section title="Finansal Tablolar" defaultOpen>
          <div className="space-y-3">

            {/* Çeyreklik tablo */}
            {hasQuarterly && (
              <SubSection title="Çeyreklik Görünüm" defaultOpen>
                <div style={{ marginBottom: 6 }} className="flex items-center justify-end">
                  <p style={{ color: "var(--text-muted)", fontSize: 10 }}>Y = Yıldan Yıla · Q = Çeyrekten Çeyreğe</p>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]" style={{ minWidth: 480 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                          <th className="text-left px-4 py-2" style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", width: 120 }}>Metrik</th>
                          {Array.from({ length: SHOW_Q }).map((_, qi) => {
                            const revIdx = SHOW_Q - 1 - qi;
                            return <th key={qi} className="text-right px-3 py-2" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{qCols[revIdx] ?? `Q${qi+1}`}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Hasılat", values: qRevenue, fmtVal: (v: number | null) => fmtBig(v, quote.currency), isMargin: false },
                          { label: "Net Kar", values: qNetIncome, fmtVal: (v: number | null) => fmtBig(v, quote.currency), isMargin: false },
                          { label: "Net Marj", values: qNetMargin, fmtVal: (v: number | null) => v != null ? `${v.toFixed(1)}%` : "—", isMargin: true },
                          { label: "Brüt Marj", values: qGrossMargin, fmtVal: (v: number | null) => v != null ? `${v.toFixed(1)}%` : "—", isMargin: true },
                          ...(qEps.some(v => v != null) ? [{ label: "HBK", values: qEps, fmtVal: (v: number | null) => v != null ? v.toFixed(2) : "—", isMargin: false }] : []),
                        ].map((row, ri) => (
                          <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="px-4 py-2" style={{ color: "var(--text-muted)", fontSize: 11 }}>{row.label}</td>
                            {Array.from({ length: SHOW_Q }).map((_, qi) => {
                              const revIdx = SHOW_Q - 1 - qi;
                              const val = row.values[revIdx];
                              const yoy = !row.isMargin ? qYoY(row.values, revIdx) : null;
                              const qoq = !row.isMargin ? qQoQ(row.values, revIdx) : null;
                              const marginQoQ = row.isMargin && val != null && row.values[revIdx + 1] != null ? val - (row.values[revIdx + 1] as number) : null;
                              const marginYoY = row.isMargin && val != null && row.values[revIdx + 4] != null ? val - (row.values[revIdx + 4] as number) : null;
                              return (
                                <td key={qi} className="text-right px-3 py-2">
                                  <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }} className="tabular-nums">{val != null ? row.fmtVal(val) : "—"}</div>
                                  <div className="flex justify-end gap-1 mt-0.5">
                                    {(yoy != null || marginYoY != null) && (() => {
                                      const pct = yoy ?? marginYoY!;
                                      return <span style={{ color: pct >= 0 ? "var(--up)" : "var(--down)", fontSize: 9.5 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}{row.isMargin ? "pp" : "%"} Y</span>;
                                    })()}
                                    {(qoq != null || marginQoQ != null) && (() => {
                                      const pct = qoq ?? marginQoQ!;
                                      return <span style={{ color: pct >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)", fontSize: 9.5 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}{row.isMargin ? "pp" : "%"} Q</span>;
                                    })()}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SubSection>
            )}

            {/* Yıllık özet */}
            {(hasIncomeSummary || hasBalanceSummary) && (
              <SubSection title="Yıllık Özet" defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {hasIncomeSummary && (
                    <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8 }} className="p-3">
                      <div className="flex justify-between items-center mb-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                        <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>Gelir Tablosu</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 10 }} className="tabular-nums">{incLatest}{incPrev ? ` vs ${incPrev}` : ""}</p>
                      </div>
                      <FinRow label="Hasılat" current={annRevenue[0] ?? null} previous={annRevenue[1] ?? null} currency={quote.currency} />
                      <FinRow label="Brüt Kar" current={annGross[0] ?? null} previous={annGross[1] ?? null} currency={quote.currency} />
                      <FinRow label="FAVÖK" current={(annEbitda[0] ?? annOpInc[0]) ?? null} previous={(annEbitda[1] ?? annOpInc[1]) ?? null} currency={quote.currency} />
                      <FinRow label="Net Kar" current={annNet[0] ?? null} previous={annNet[1] ?? null} currency={quote.currency} />
                      {annEps[0] != null && <FinRow label="HBK (EPS)" current={annEps[0] ?? null} previous={annEps[1] ?? null} currency={null} />}
                      {hasCashflow && (
                        <>
                          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                            <p style={{ color: "var(--text-muted)", fontSize: 9, fontWeight: 600 }} className="uppercase tracking-wide mb-1">Nakit Akışı</p>
                          </div>
                          <FinRow label="İşletme NK" current={cfOcf[0] ?? null} previous={cfOcf[1] ?? null} currency={quote.currency} />
                          {cfFcf[0] != null && <FinRow label="Serbest NK (FCF)" current={cfFcf[0] ?? null} previous={cfFcf[1] ?? null} currency={quote.currency} />}
                        </>
                      )}
                    </div>
                  )}
                  {hasBalanceSummary && (
                    <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8 }} className="p-3">
                      <div className="flex justify-between items-center mb-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                        <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>Bilanço</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 10 }} className="tabular-nums">{balLatest}{balPrev ? ` vs ${balPrev}` : ""}</p>
                      </div>
                      <FinRow label="Toplam Varlık" current={balAssets[0] ?? null} previous={balAssets[1] ?? null} currency={quote.currency} />
                      <FinRow label="Toplam Yükümlülük" current={balLiab[0] ?? null} previous={balLiab[1] ?? null} currency={quote.currency} />
                      <FinRow label="Özsermaye" current={balEquity[0] ?? null} previous={balEquity[1] ?? null} currency={quote.currency} />
                      {balNetDebt[0] != null && <FinRow label="Net Borç" current={balNetDebt[0] ?? null} previous={balNetDebt[1] ?? null} currency={quote.currency} />}
                    </div>
                  )}
                </div>
              </SubSection>
            )}

            {/* Finansal grafikler */}
            {hasCharts && (
              <SubSection title="Gelişim Grafikleri" defaultOpen={false}>
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <div style={{ display: "flex", background: "var(--bg-tertiary)", borderRadius: 8, padding: 2, gap: 2, border: "1px solid var(--border)" }}>
                      {(["quarterly", "annual"] as Freq[]).map((f) => (
                        <button key={f} onClick={() => setFreq(f)}
                          style={{ background: freq === f ? "var(--accent-muted)" : "transparent", color: freq === f ? "var(--accent-primary)" : "var(--text-muted)", border: freq === f ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                          {f === "quarterly" ? "Çeyreklik" : "Yıllık"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { title: "Satışlar", data: revenueBar },
                      { title: "FAVÖK / Faaliyet Karı", data: ebitdaBar },
                      { title: "Net Kar", data: netIncomeBar },
                    ].map(({ title, data }) => data.length > 0 && (
                      <div key={title} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8 }} className="p-3">
                        <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{title}</p>
                        <BarChart data={data} color="var(--chart-blue)" height={140} showGrowth />
                      </div>
                    ))}
                  </div>
                </div>
              </SubSection>
            )}

            {/* Marj trendleri */}
            {hasMargins && (
              <SubSection title="Karlılık Marjı Trendi" defaultOpen={false}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { title: "Brüt Marj", data: grossMarginLine, color: "var(--chart-gold)" },
                    { title: "Faaliyet Marjı", data: opMarginLine, color: "var(--chart-gold)" },
                    { title: "Net Marj", data: netMarginLine, color: "var(--chart-pink)" },
                  ].map(({ title, data, color }) => data.length > 1 && (
                    <div key={title} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8 }} className="p-3">
                      <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{title}</p>
                      <LineChart data={data} color={color} height={120} unit="%" formatY={(v) => v.toFixed(1) + "%"} />
                    </div>
                  ))}
                </div>
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* ── Reel Getiri (BIST) ─────────────────────── defaultOpen=false ─────── */}
      {realReturn && realReturn.periods.length > 0 && (
        <Section title="Reel Getiri (TÜFE Düzeltilmiş)" defaultOpen={false}
          badge={<span style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent-primary)", borderRadius: 6, fontSize: 10, fontWeight: 600, padding: "1px 7px" }}>BIST</span>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {realReturn.periods.map((p) => {
              const realPositive = p.real != null && p.real >= 0;
              const realColor = p.real == null ? "var(--text-muted)" : realPositive ? "var(--up)" : "var(--down)";
              return (
                <div key={p.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10 }} className="p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }} className="text-[12px]">{p.label}</span>
                    <span style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">{p.startDate} → {p.endDate}</span>
                  </div>
                  <p style={{ color: realColor, fontSize: 26, fontWeight: 800 }} className="tabular-nums leading-tight">
                    {p.real == null ? "—" : `${p.real >= 0 ? "+" : ""}${p.real.toFixed(1)}%`}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>Reel getiri</p>
                  <div className="flex gap-4 mt-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <div>
                      <p style={{ color: "var(--text-muted)", fontSize: 9.5 }} className="uppercase tracking-wide">Nominal</p>
                      <p style={{ color: p.nominal >= 0 ? "var(--up)" : "var(--down)", fontSize: 12, fontWeight: 600 }} className="tabular-nums">
                        {p.nominal >= 0 ? "+" : ""}{p.nominal.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)", fontSize: 9.5 }} className="uppercase tracking-wide">TÜFE</p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }} className="tabular-nums">
                        {p.inflation == null ? "—" : `+${p.inflation.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Değerleme ───────────────────────────────────────────────────────── */}
      <Section title="Değerleme & Adil Değer" defaultOpen>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IntrinsicValueCard ticker={ticker} />
            <LongTermScoreCard ticker={ticker} />
          </div>
          <ValuationScore ticker={ticker} />
        </div>
      </Section>

      {/* ── Kalite & Risk ── */}
      <Section title="Kalite & Risk Skorları" defaultOpen={false}>
        <QualityScoresCard ticker={ticker} />
      </Section>

      {/* ── Bilanço Analizi ── */}
      <Section title="Bilanço Analizi & Uzun Vade Yorum" defaultOpen={false}>
        <BalanceSheetAnalysisCard ticker={ticker} />
      </Section>

      {/* ── Sektör Karşılaştırma ── */}
      <Section title="Sektör Karşılaştırma" defaultOpen={false}>
        <PeerComparisonCard ticker={ticker} />
      </Section>

    </div>
  );
}
