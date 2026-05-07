"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, type Quote, type FinancialStatement, type OHLCVBar } from "@/lib/api";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ValuationScore } from "./ValuationScore";
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

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">{label}</span>
      <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium tabular-nums">{value}</span>
    </div>
  );
}

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
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("6A");
  const [freq, setFreq] = useState<Freq>("quarterly");
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    setLoadingInit(true);
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
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-40 animate-pulse" />
        ))}
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
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl px-5 py-4 flex flex-wrap gap-6">
        <QuickStat label="Önceki Kapanış" value={formatPrice(quote.previousClose, quote.currency)} />
        <QuickStat label="52H Yüksek" value={formatPrice(quote.fiftyTwoWeekHigh, quote.currency)} />
        <QuickStat label="52H Düşük" value={formatPrice(quote.fiftyTwoWeekLow, quote.currency)} />
        <QuickStat label="Günlük Hacim" value={formatVolume(quote.volume)} />
        <QuickStat label="Ort. Hacim (3A)" value={formatVolume(quote.avgVolume)} />
        <QuickStat label="Piyasa Değeri" value={formatMarketCap(quote.marketCap, quote.currency)} />
        <QuickStat label="F/K Oranı" value={formatRatio(quote.pe)} />
        <QuickStat label="HBK (EPS)" value={formatRatio(quote.eps)} />
        <QuickStat label="Temettü Getirisi" value={formatPercent(quote.dividendYield)} />
        <QuickStat label="Beta" value={formatRatio(quote.beta)} />
      </div>

      {/* Özet Finansallar — two column table */}
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

      {/* Valuation score */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Değerleme</p>
        <ValuationScore ticker={ticker} />
      </div>

      {/* Company description */}
      {quote.summary && (
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-2">Şirket Hakkında</p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }} className="text-[13px]">{quote.summary}</p>
        </div>
      )}
    </div>
  );
}
