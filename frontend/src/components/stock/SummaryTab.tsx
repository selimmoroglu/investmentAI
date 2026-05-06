"use client";

import { useEffect, useState } from "react";
import { api, type Quote, type FinancialStatement } from "@/lib/api";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ValuationScore } from "./ValuationScore";
import { formatPrice, formatVolume, formatMarketCap, formatRatio, formatPercent } from "@/lib/formatters";

interface SummaryTabProps {
  ticker: string;
}

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

function toBarData(values: (number | null)[], cols: string[], limit = 6) {
  return cols.slice(0, limit).map((col, i) => ({
    label: col,
    value: values[i] ?? 0,
  })).filter(d => d.value !== 0);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.quote(ticker),
      api.financials(ticker, "income", "quarterly"),
    ]).then(([q, inc]) => {
      setQuote(q);
      setIncomeQ(inc);
    }).catch(console.error).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!quote) return <div className="p-6" style={{ color: "var(--text-muted)" }}>Veri alınamadı.</div>;

  // Parse quarterly financial data
  const cols = incomeQ?.columns ?? [];
  const revenue = parseFinRow(incomeQ, ["Total Revenue", "Revenue"]);
  const grossProfit = parseFinRow(incomeQ, ["Gross Profit"]);
  const operatingIncome = parseFinRow(incomeQ, ["Operating Income", "Ebit"]);
  const netIncome = parseFinRow(incomeQ, ["Net Income"]);
  const ebitda = parseFinRow(incomeQ, ["EBITDA"]);

  const revenueBar = toBarData(revenue, cols, 6);
  const ebitdaBar = toBarData(ebitda.length ? ebitda : operatingIncome, cols, 6);
  const netIncomeBar = toBarData(netIncome, cols, 6);

  const grossMarginLine = toMarginSeries(grossProfit, revenue, cols, 8);
  const opMarginLine = toMarginSeries(operatingIncome, revenue, cols, 8);
  const netMarginLine = toMarginSeries(netIncome, revenue, cols, 8);

  const hasCharts = revenueBar.length > 1;
  const hasMargins = grossMarginLine.length > 1;

  return (
    <div className="p-5 space-y-5 max-w-[1100px]">
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

      {/* Quarterly bar charts */}
      {hasCharts && (
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">Çeyreklik Veriler</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Çeyreklik Satışlar", data: revenueBar, color: "var(--chart-blue)" },
              { title: "Çeyreklik FAVÖK", data: ebitdaBar, color: "var(--chart-blue)" },
              { title: "Çeyreklik Net Kar", data: netIncomeBar, color: netIncomeBar.some(d => d.value < 0) ? undefined : "var(--chart-blue)" },
            ].map(({ title, data, color }) => (
              data.length > 0 && (
                <div key={title} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                  <p style={{ color: "var(--text-secondary)" }} className="text-[12px] font-medium mb-3">{title}</p>
                  <BarChart data={data} color={color} height={130} />
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
                  <LineChart data={data} color={color} height={150} unit="%" formatY={(v) => v.toFixed(1) + "%"} />
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
