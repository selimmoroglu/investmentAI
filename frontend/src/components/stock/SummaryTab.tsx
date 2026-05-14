"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, type Quote, type FinancialStatement, type OHLCVBar, type RealReturn } from "@/lib/api";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ValuationScore } from "./ValuationScore";
import { QualityScoresCard } from "./QualityScoresCard";
import { IntrinsicValueCard } from "./IntrinsicValueCard";
import { LongTermScoreCard } from "./LongTermScoreCard";
import { PeerComparisonCard } from "./PeerComparisonCard";
import { Card, Stat, Skeleton, Badge } from "@/components/ui";
import { formatPrice, formatVolume, formatMarketCap, formatRatio, formatPercent } from "@/lib/formatters";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart").then((m) => ({ default: m.CandlestickChart })),
  { ssr: false }
);

interface SummaryTabProps {
  ticker: string;
}

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
  if (abs >= 1_000_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

function yoyChange(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function FinSummaryRow({
  label,
  current,
  previous,
  currency,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  currency?: string | null;
}) {
  const change = yoyChange(current, previous);
  const isUp = change != null && change >= 0;
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }} className="grid grid-cols-[1fr_auto_70px] items-center gap-3 py-2 last:border-b-0">
      <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">{label}</span>
      <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums text-right">{fmtBig(current, currency)}</span>
      <span
        style={{ color: change == null ? "var(--text-muted)" : isUp ? "var(--up)" : "var(--down)" }}
        className="text-[11px] font-medium tabular-nums text-right"
      >
        {change == null ? "—" : `${isUp ? "+" : ""}${change.toFixed(1)}%`}
      </span>
    </div>
  );
}

function toBarData(values: (number | null)[], cols: string[], limit = 8) {
  return cols.slice(0, limit).map((col, i) => ({
    label: col,
    value: values[i] ?? 0,
  })).filter(d => d.value !== 0).reverse();
}

function toMarginSeries(numerator: (number | null)[], denominator: (number | null)[], cols: string[], limit = 8) {
  return cols.slice(0, limit).map((col, i) => {
    const num = numerator[i];
    const den = denominator[i];
    const val = num != null && den != null && den !== 0 ? (num / den) * 100 : null;
    return { label: col, value: val ?? 0 };
  }).filter(d => d.value !== 0).reverse();
}

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
      setQuote(q);
      setIncomeQ(incQ);
      setIncomeA(incA);
      setBalanceA(balA);
      setHistory(hist);
    }).catch(console.error).finally(() => setLoadingInit(false));

    // Nakit akışı ve reel getiri — ayrı yükle (kritik path değil)
    api.financials(ticker, "cashflow", "annual").then(setCashflowA).catch(() => null);
    if (ticker.toUpperCase().endsWith(".IS")) {
      api.realReturn(ticker).then(setRealReturn).catch(() => setRealReturn(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  useEffect(() => {
    if (loadingInit) return;
    setLoadingChart(true);
    const { period, interval } = PERIOD_MAP[selectedPeriod];
    api.history(ticker, period, interval)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoadingChart(false));
  }, [selectedPeriod, ticker]);

  if (loadingInit) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton height="360px" />
        <Skeleton height="80px" />
        <Skeleton height="220px" />
        <Skeleton height="220px" />
      </div>
    );
  }

  if (!quote) return <div className="p-6" style={{ color: "var(--text-muted)" }}>Veri alınamadı.</div>;

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

  // Özet Finansallar — annual data (latest two columns for Y/Y)
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

  const hasIncomeSummary = annCols.length >= 1 && annRevenue.length >= 1 && annRevenue[0] != null;
  const hasBalanceSummary = balCols.length >= 1 && balAssets.length >= 1 && balAssets[0] != null;
  const hasFinSummary = hasIncomeSummary || hasBalanceSummary;

  const incLatest = annCols[0];
  const incPrev = annCols[1];
  const balLatest = balCols[0];
  const balPrev = balCols[1];

  // Nakit akışı — yıllık
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

  // Çeyreklik snapshot: son 4-8 çeyrek YoY + QoQ
  const qCols = (incomeQ?.columns ?? []).slice(0, 8);
  const qRevenue = parseFinRow(incomeQ, ["Total Revenue", "Revenue"]);
  const qNetIncome = parseFinRow(incomeQ, ["Net Income"]);
  const qGrossProfit = parseFinRow(incomeQ, ["Gross Profit"]);
  const qOpIncome = parseFinRow(incomeQ, ["Operating Income", "Ebit"]);
  const qEps = parseFinRow(incomeQ, ["Diluted EPS", "Basic EPS"]);

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
  const qNetMargin = qCols.map((_, i) => {
    const rev = qRevenue[i]; const ni = qNetIncome[i];
    return rev && rev !== 0 && ni != null ? (ni / rev) * 100 : null;
  });
  const qGrossMargin = qCols.map((_, i) => {
    const rev = qRevenue[i]; const gp = qGrossProfit[i];
    return rev && rev !== 0 && gp != null ? (gp / rev) * 100 : null;
  });

  // Son 4 çeyreği göster (idx 0 = en son), en eskiden yeniye (görsel için reverse)
  const SHOW_Q = Math.min(4, qCols.length);
  const hasQuarterly = SHOW_Q >= 2 && qRevenue.slice(0, SHOW_Q).some(v => v != null);

  return (
    <div className="p-5 space-y-5 max-w-[1100px]">
      {/* Price chart */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
        {/* Period selector */}
        <div style={{ borderBottom: "1px solid var(--border)" }} className="px-4 py-2 flex items-center gap-1">
          {(["1G", "1H", "1A", "6A", "1Y", "5Y"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              style={{
                background: selectedPeriod === p ? "var(--bg-tertiary)" : "transparent",
                color: selectedPeriod === p ? "var(--text-primary)" : "var(--text-muted)",
                border: selectedPeriod === p ? "1px solid var(--border)" : "1px solid transparent",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {p}
            </button>
          ))}
          {loadingChart && (
            <span style={{ color: "var(--text-muted)", fontSize: 11 }} className="ml-2">Yükleniyor...</span>
          )}
        </div>
        {history.length > 0 ? (
          <CandlestickChart data={history} height={340} />
        ) : (
          <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }} className="text-sm">
            Grafik verisi yüklenemedi.
          </div>
        )}
      </div>

      {/* Quick stats bar */}
      <Card variant="elevated" padding="lg" className="flex flex-wrap gap-x-8 gap-y-4">
        <Stat label="Önceki Kapanış" value={formatPrice(quote.previousClose, quote.currency)} size="sm" />
        <Stat label="52H Yüksek" value={formatPrice(quote.fiftyTwoWeekHigh, quote.currency)} size="sm" />
        <Stat label="52H Düşük" value={formatPrice(quote.fiftyTwoWeekLow, quote.currency)} size="sm" />
        <Stat label="Günlük Hacim" value={formatVolume(quote.volume)} size="sm" />
        <Stat label="Ort. Hacim (3A)" value={formatVolume(quote.avgVolume)} size="sm" />
        <Stat label="Piyasa Değeri" value={formatMarketCap(quote.marketCap, quote.currency)} size="sm" />
        <Stat label="F/K Oranı" value={formatRatio(quote.pe)} size="sm" />
        <Stat label="HBK (EPS)" value={formatRatio(quote.eps)} size="sm" />
        <Stat label="Temettü Getirisi" value={formatPercent(quote.dividendYield)} size="sm" />
        <Stat label="Beta" value={formatRatio(quote.beta)} size="sm" />
      </Card>

      {/* Analist Konsensüsü + Nakit Üretme Gücü */}
      {(quote.targetMeanPrice != null || quote.freeCashflow != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Analist Konsensüsü */}
          {quote.targetMeanPrice != null && quote.currentPrice != null && (() => {
            const tm = quote.targetMeanPrice!;
            const cp = quote.currentPrice!;
            const upside = ((tm - cp) / cp) * 100;
            const upsideUp = upside >= 0;
            const recKey = (quote.recommendationKey || "").toLowerCase();
            const recTone: "up" | "down" | "warn" | "neutral" =
              recKey === "strong_buy" || recKey === "buy" ? "up" :
              recKey === "sell" || recKey === "strong_sell" ? "down" :
              recKey === "hold" ? "warn" : "neutral";
            const recLabel: Record<string, string> = {
              strong_buy: "Güçlü Al",
              buy: "Al",
              hold: "Tut",
              sell: "Sat",
              strong_sell: "Güçlü Sat",
              underperform: "Düşük Performans",
              none: "—",
            };
            return (
              <Card variant="elevated" padding="lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Analist Konsensüsü</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11px] mt-0.5">
                      {quote.numberOfAnalystOpinions != null ? `${quote.numberOfAnalystOpinions} analist tahmini` : "Wall Street tahmini"}
                    </p>
                  </div>
                  {quote.recommendationKey && (
                    <Badge tone={recTone} size="md">
                      {recLabel[recKey] || quote.recommendationKey}
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <div>
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">Hedef Fiyat</p>
                    <p style={{ color: "var(--text-primary)" }} className="text-[22px] font-bold tabular-nums leading-tight">
                      {formatPrice(tm, quote.currency)}
                    </p>
                  </div>
                  <Badge tone={upsideUp ? "up" : "down"} size="md">
                    {upsideUp ? "+" : ""}{upside.toFixed(2)}% upside
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <Stat label="Tahmin Üst" value={formatPrice(quote.targetHighPrice, quote.currency)} size="sm" />
                  <Stat label="Tahmin Alt" value={formatPrice(quote.targetLowPrice, quote.currency)} size="sm" />
                </div>
              </Card>
            );
          })()}

          {/* Nakit Üretme Gücü */}
          {quote.freeCashflow != null && (() => {
            const fcf = quote.freeCashflow!;
            const fcfMargin = quote.totalRevenue ? (fcf / quote.totalRevenue) * 100 : null;
            const fcfYield = quote.marketCap ? (fcf / quote.marketCap) * 100 : null;
            const fcfPositive = fcf > 0;
            return (
              <Card variant="elevated" padding="lg">
                <div className="mb-3">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Nakit Üretme Gücü</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-[11px] mt-0.5">
                    Serbest Nakit Akışı — uzun vadeli kalite göstergesi
                  </p>
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <div>
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">Yıllık FCF</p>
                    <p
                      style={{ color: fcfPositive ? "var(--text-primary)" : "var(--down)" }}
                      className="text-[22px] font-bold tabular-nums leading-tight"
                    >
                      {formatMarketCap(fcf, quote.currency)}
                    </p>
                  </div>
                  {fcfYield != null && (
                    <Badge tone={fcfYield > 5 ? "up" : fcfYield > 2 ? "warn" : "neutral"} size="md">
                      FCF Verimi {fcfYield.toFixed(2)}%
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <Stat
                    label="FCF Marjı"
                    value={fcfMargin != null ? `${fcfMargin.toFixed(2)}%` : "—"}
                    tone={fcfMargin != null && fcfMargin >= 10 ? "up" : fcfMargin != null && fcfMargin < 0 ? "down" : "default"}
                    size="sm"
                  />
                  <Stat
                    label="Net Borç"
                    value={
                      quote.totalDebt != null && quote.totalCash != null
                        ? formatMarketCap(quote.totalDebt - quote.totalCash, quote.currency)
                        : "—"
                    }
                    size="sm"
                  />
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Reel Getiri (TÜFE Düzeltilmiş) — sadece BIST */}
      {realReturn && realReturn.periods.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
              <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium">Reel Getiri (TÜFE Düzeltilmiş)</p>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">Satın alma gücü kazancı — Reel = ((1+Nominal) / (1+TÜFE)) − 1</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {realReturn.periods.map((p) => {
              const isReal = p.real != null;
              const realPositive = isReal && p.real! >= 0;
              const realColor = !isReal ? "var(--text-muted)" : realPositive ? "var(--up)" : "var(--down)";
              const nominalPositive = p.nominal >= 0;
              return (
                <div
                  key={p.label}
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  className="rounded-xl p-4"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <span style={{ color: "var(--text-secondary)" }} className="text-[12px] font-semibold">{p.label}</span>
                    <span style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">{p.startDate} → {p.endDate}</span>
                  </div>
                  <p style={{ color: realColor }} className="text-[28px] font-bold tabular-nums leading-tight">
                    {!isReal ? "—" : `${p.real! >= 0 ? "+" : ""}${p.real!.toFixed(2)}%`}
                  </p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-1">Reel getiri</p>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <div>
                      <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">Nominal</p>
                      <p
                        style={{ color: nominalPositive ? "var(--up)" : "var(--down)" }}
                        className="text-[13px] font-semibold tabular-nums"
                      >
                        {p.nominal >= 0 ? "+" : ""}{p.nominal.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">TÜFE</p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-[13px] font-semibold tabular-nums">
                        {p.inflation == null ? "—" : `+${p.inflation.toFixed(2)}%`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Çeyreklik Anlık Görünüm — son 4 çeyrek */}
      {hasQuarterly && (
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">
            Çeyreklik Anlık Görünüm
          </p>
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
            {/* Kolon başlıkları */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]" style={{ minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                    <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", width: 130 }}>
                      Metrik
                    </th>
                    {Array.from({ length: SHOW_Q }).map((_, qi) => {
                      const revIdx = SHOW_Q - 1 - qi; // eskiden yeniye sıralı
                      return (
                        <th key={qi} className="text-right px-3 py-2.5 font-semibold" style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                          {qCols[revIdx] ?? `Q${qi + 1}`}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Hasılat",
                      values: qRevenue,
                      fmtVal: (v: number | null) => fmtBig(v, quote.currency),
                      isMargin: false,
                    },
                    {
                      label: "Net Kar",
                      values: qNetIncome,
                      fmtVal: (v: number | null) => fmtBig(v, quote.currency),
                      isMargin: false,
                    },
                    {
                      label: "Net Kar Marjı",
                      values: qNetMargin,
                      fmtVal: (v: number | null) => v != null ? `${v.toFixed(1)}%` : "—",
                      isMargin: true,
                    },
                    {
                      label: "Brüt Marj",
                      values: qGrossMargin,
                      fmtVal: (v: number | null) => v != null ? `${v.toFixed(1)}%` : "—",
                      isMargin: true,
                    },
                    ...(qEps.some(v => v != null) ? [{
                      label: "HBK (EPS)",
                      values: qEps,
                      fmtVal: (v: number | null) => v != null ? v.toFixed(2) : "—",
                      isMargin: false,
                    }] : []),
                  ].map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: ri < 4 ? "1px solid var(--border)" : "none" }}>
                      <td className="px-4 py-2" style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                        {row.label}
                      </td>
                      {Array.from({ length: SHOW_Q }).map((_, qi) => {
                        const revIdx = SHOW_Q - 1 - qi;
                        const val = row.values[revIdx];
                        const yoy = !row.isMargin ? qYoY(row.values, revIdx) : null;
                        const qoq = !row.isMargin ? qQoQ(row.values, revIdx) : null;
                        // Marj için QoQ pp fark
                        const marginQoQ = row.isMargin && val != null && row.values[revIdx + 1] != null
                          ? val - (row.values[revIdx + 1] as number)
                          : null;
                        const marginYoY = row.isMargin && val != null && row.values[revIdx + 4] != null
                          ? val - (row.values[revIdx + 4] as number)
                          : null;

                        return (
                          <td key={qi} className="text-right px-3 py-2">
                            <div style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums">
                              {val != null ? row.fmtVal(val) : "—"}
                            </div>
                            <div className="flex justify-end gap-1 mt-0.5">
                              {/* YoY */}
                              {(yoy != null || marginYoY != null) && (() => {
                                const pct = yoy ?? marginYoY;
                                const isUp = pct! >= 0;
                                const label = row.isMargin
                                  ? `${pct! >= 0 ? "+" : ""}${pct!.toFixed(1)}pp Y`
                                  : `${pct! >= 0 ? "+" : ""}${pct!.toFixed(1)}% Y`;
                                return (
                                  <span style={{ color: isUp ? "var(--up)" : "var(--down)", fontSize: 9.5, fontWeight: 500 }}>
                                    {label}
                                  </span>
                                );
                              })()}
                              {/* QoQ */}
                              {(qoq != null || marginQoQ != null) && (() => {
                                const pct = qoq ?? marginQoQ;
                                const isUp = pct! >= 0;
                                const label = row.isMargin
                                  ? `${pct! >= 0 ? "+" : ""}${pct!.toFixed(1)}pp Q`
                                  : `${pct! >= 0 ? "+" : ""}${pct!.toFixed(1)}% Q`;
                                return (
                                  <span style={{ color: isUp ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)", fontSize: 9.5 }}>
                                    {label}
                                  </span>
                                );
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
            <div className="px-4 py-2" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px]">
                Y = Yıldan Yıla (aynı çeyrek) · Q = Çeyrekten Çeyreğe · pp = yüzde puan fark
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Özet Finansallar — yıllık */}
      {hasFinSummary && (
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Özet Finansallar (Yıllık)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasIncomeSummary && (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Gelir Tablosu</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">
                    {incLatest}{incPrev ? ` vs ${incPrev}` : ""}
                  </p>
                </div>
                <FinSummaryRow label="Hasılat" current={annRevenue[0] ?? null} previous={annRevenue[1] ?? null} currency={quote.currency} />
                <FinSummaryRow label="Brüt Kar" current={annGross[0] ?? null} previous={annGross[1] ?? null} currency={quote.currency} />
                <FinSummaryRow label="FAVÖK" current={(annEbitda[0] ?? annOpInc[0]) ?? null} previous={(annEbitda[1] ?? annOpInc[1]) ?? null} currency={quote.currency} />
                <FinSummaryRow label="Esas Faaliyet Karı" current={annOpInc[0] ?? null} previous={annOpInc[1] ?? null} currency={quote.currency} />
                <FinSummaryRow label="Net Kar" current={annNet[0] ?? null} previous={annNet[1] ?? null} currency={quote.currency} />
                {annEps[0] != null && (
                  <FinSummaryRow label="HBK (EPS)" current={annEps[0] ?? null} previous={annEps[1] ?? null} currency={null} />
                )}
                {/* Nakit akışı özeti */}
                {hasCashflow && (
                  <>
                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }} className="text-[9.5px] uppercase tracking-wide font-semibold mb-1">Nakit Akışı</p>
                    </div>
                    <FinSummaryRow label="İşletme Nakit Akışı (OCF)" current={cfOcf[0] ?? null} previous={cfOcf[1] ?? null} currency={quote.currency} />
                    {cfCapex[0] != null && (
                      <FinSummaryRow label="Sermaye Harcaması (CapEx)" current={cfCapex[0] != null ? -Math.abs(cfCapex[0]) : null} previous={cfCapex[1] != null ? -Math.abs(cfCapex[1]) : null} currency={quote.currency} />
                    )}
                    {cfFcf[0] != null && (
                      <FinSummaryRow label="Serbest Nakit Akışı (FCF)" current={cfFcf[0] ?? null} previous={cfFcf[1] ?? null} currency={quote.currency} />
                    )}
                  </>
                )}
              </div>
            )}
            {hasBalanceSummary && (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Bilanço</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">
                    {balLatest}{balPrev ? ` vs ${balPrev}` : ""}
                  </p>
                </div>
                <FinSummaryRow label="Toplam Varlık" current={balAssets[0] ?? null} previous={balAssets[1] ?? null} currency={quote.currency} />
                <FinSummaryRow label="Toplam Yükümlülük" current={balLiab[0] ?? null} previous={balLiab[1] ?? null} currency={quote.currency} />
                <FinSummaryRow label="Özsermaye" current={balEquity[0] ?? null} previous={balEquity[1] ?? null} currency={quote.currency} />
                {balNetDebt[0] != null && (
                  <FinSummaryRow label="Net Borç" current={balNetDebt[0] ?? null} previous={balNetDebt[1] ?? null} currency={quote.currency} />
                )}
                {/* FCF / Revenue (nakit üretkenliği) */}
                {cfFcf[0] != null && annRevenue[0] != null && annRevenue[0] !== 0 && (
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-muted)" }} className="text-[9.5px] uppercase tracking-wide font-semibold mb-1">Kârlılık Oranları</p>
                    {annRevenue[0] && cfFcf[0] && (() => {
                      const fcfMargin = (cfFcf[0]! / annRevenue[0]!) * 100;
                      const fcfColor = fcfMargin >= 10 ? "var(--up)" : fcfMargin >= 5 ? "var(--text-primary)" : "var(--down)";
                      return (
                        <div style={{ borderBottom: "1px solid var(--border)" }} className="grid grid-cols-[1fr_auto_70px] items-center gap-3 py-2 last:border-b-0">
                          <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">FCF Marjı</span>
                          <span style={{ color: fcfColor }} className="text-[12px] font-medium tabular-nums text-right">{fcfMargin.toFixed(1)}%</span>
                          <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums text-right">—</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial charts */}
      {hasCharts && (
        <div>
          {/* Header with quarterly/annual toggle */}
          <div className="flex items-center justify-between mb-3">
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium">
              {freq === "quarterly" ? "Çeyreklik" : "Yıllık"} Finansallar
            </p>
            <div style={{ display: "flex", background: "var(--bg-tertiary)", borderRadius: 8, padding: 2, gap: 2 }}>
              {(["quarterly", "annual"] as Freq[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  style={{
                    background: freq === f ? "var(--bg-secondary)" : "transparent",
                    color: freq === f ? "var(--text-primary)" : "var(--text-muted)",
                    border: freq === f ? "1px solid var(--border)" : "1px solid transparent",
                    borderRadius: 6,
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  {f === "quarterly" ? "Çeyreklik" : "Yıllık"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: freq === "quarterly" ? "Çeyreklik Satışlar" : "Yıllık Satışlar", data: revenueBar, color: "var(--chart-blue)" },
              { title: freq === "quarterly" ? "Çeyreklik FAVÖK" : "Yıllık FAVÖK", data: ebitdaBar, color: "var(--chart-blue)" },
              { title: freq === "quarterly" ? "Çeyreklik Net Kar" : "Yıllık Net Kar", data: netIncomeBar, color: "var(--chart-blue)" },
            ].map(({ title, data, color }) => (
              data.length > 0 && (
                <div key={title} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                  <p style={{ color: "var(--text-secondary)" }} className="text-[12px] font-medium mb-2">{title}</p>
                  <BarChart data={data} color={color} height={150} />
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Margin trend charts */}
      {hasMargins && (
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Karlılık Marjı Trendi (%)</p>
          <div className="grid grid-cols-1 gap-4">
            {[
              { title: "Brüt Kar Marjı", data: grossMarginLine, color: "var(--chart-gold)" },
              { title: "Esas Faaliyet Kar Marjı", data: opMarginLine, color: "var(--chart-gold)" },
              { title: "Net Kar Marjı", data: netMarginLine, color: "var(--chart-pink)" },
            ].map(({ title, data, color }) => (
              data.length > 1 && (
                <div key={title} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                  <p style={{ color: "var(--text-secondary)" }} className="text-[12px] font-medium mb-2">{title}</p>
                  <LineChart data={data} color={color} height={140} unit="%" formatY={(v) => v.toFixed(1) + "%"} />
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Kalite & Risk */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Kalite & Risk Skorları</p>
        <QualityScoresCard ticker={ticker} />
      </div>

      {/* DCF Adil Değer + Uzun Vade Skoru */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Adil Değer & Uzun Vade Skoru</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <IntrinsicValueCard ticker={ticker} />
          <LongTermScoreCard ticker={ticker} />
        </div>
      </div>

      {/* Sektör Emsalleri */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Sektör Karşılaştırma</p>
        <PeerComparisonCard ticker={ticker} />
      </div>

      {/* Valuation score */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Değerleme</p>
        <ValuationScore ticker={ticker} />
      </div>

    </div>
  );
}
