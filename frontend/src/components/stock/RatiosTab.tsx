"use client";

import { useEffect, useState } from "react";
import { api, type Ratios, type FinancialStatement } from "@/lib/api";
import { LineChart } from "@/components/charts/LineChart";
import { formatRatio, formatPercent } from "@/lib/formatters";

interface RatiosTabProps {
  ticker: string;
}

interface SeriesPoint {
  label: string;
  value: number;
}

function findRow(stmt: FinancialStatement | null, keywords: string[]): (number | null)[] {
  if (!stmt) return [];
  const row = stmt.rows.find((r) =>
    keywords.some((k) => r.label.toLowerCase() === k.toLowerCase() || r.label.toLowerCase().includes(k.toLowerCase()))
  );
  return row?.values ?? [];
}

function buildRatioSeries(
  numerator: (number | null)[],
  denominator: (number | null)[],
  cols: string[],
  multiplier = 100
): SeriesPoint[] {
  // Backend returns most-recent-first; reverse to chronological
  const points: SeriesPoint[] = [];
  for (let i = 0; i < cols.length; i++) {
    const num = numerator[i];
    const den = denominator[i];
    if (num != null && den != null && den !== 0) {
      points.push({ label: cols[i], value: (num / den) * multiplier });
    }
  }
  return points.reverse();
}

function ChartCard({ title, data, color, unit = "%" }: {
  title: string;
  data: SeriesPoint[];
  color?: string;
  unit?: string;
}) {
  if (data.length < 2) {
    return (
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium mb-2">{title}</p>
        <div style={{ color: "var(--text-muted)" }} className="text-[12px] py-12 text-center">
          Yeterli veri yok
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
      <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium mb-3">{title}</p>
      <LineChart
        data={data}
        color={color || "var(--chart-gold)"}
        height={170}
        unit={unit}
        formatY={(v) => v.toFixed(1) + unit}
      />
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }} className="flex items-center justify-between px-4 py-2.5 last:border-b-0">
      <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">{label}</span>
      <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function RatiosTab({ ticker }: RatiosTabProps) {
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [incomeQ, setIncomeQ] = useState<FinancialStatement | null>(null);
  const [balanceQ, setBalanceQ] = useState<FinancialStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.ratios(ticker).catch(() => null),
      api.financials(ticker, "income", "quarterly").catch(() => null),
      api.financials(ticker, "balance", "quarterly").catch(() => null),
    ]).then(([r, inc, bal]) => {
      setRatios(r);
      setIncomeQ(inc);
      setBalanceQ(bal);
    }).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            className="rounded-xl h-[230px] animate-pulse" />
        ))}
      </div>
    );
  }

  // Trends — quarterly
  const incCols = incomeQ?.columns ?? [];
  const balCols = balanceQ?.columns ?? [];

  const revenue = findRow(incomeQ, ["Total Revenue", "Revenue"]);
  const grossProfit = findRow(incomeQ, ["Gross Profit"]);
  const operatingIncome = findRow(incomeQ, ["Operating Income", "Ebit"]);
  const netIncome = findRow(incomeQ, ["Net Income"]);
  const ebitda = findRow(incomeQ, ["EBITDA"]);

  const totalAssets = findRow(balanceQ, ["Total Assets"]);
  const totalLiab = findRow(balanceQ, ["Total Liabilities Net Minority Interest", "Total Liabilities"]);
  const totalEquity = findRow(balanceQ, ["Stockholders Equity", "Common Stock Equity", "Total Equity"]);
  const totalDebt = findRow(balanceQ, ["Total Debt"]);
  const currentAssets = findRow(balanceQ, ["Current Assets", "Total Current Assets"]);
  const currentLiab = findRow(balanceQ, ["Current Liabilities", "Total Current Liabilities"]);

  // Margin trends (income only)
  const grossMarginTrend = buildRatioSeries(grossProfit, revenue, incCols);
  const opMarginTrend = buildRatioSeries(operatingIncome, revenue, incCols);
  const netMarginTrend = buildRatioSeries(netIncome, revenue, incCols);
  const ebitdaMarginTrend = buildRatioSeries(ebitda.length ? ebitda : operatingIncome, revenue, incCols);

  // Return ratios (need cross-statement; assume same column ordering since both quarterly)
  // Use min length for safety
  const minLen = Math.min(incCols.length, balCols.length);
  const roeTrend = buildRatioSeries(
    netIncome.slice(0, minLen),
    totalEquity.slice(0, minLen),
    balCols.slice(0, minLen)
  );
  const roaTrend = buildRatioSeries(
    netIncome.slice(0, minLen),
    totalAssets.slice(0, minLen),
    balCols.slice(0, minLen)
  );

  // Leverage / liquidity (balance only)
  const debtToAssetsTrend = buildRatioSeries(totalDebt.length ? totalDebt : totalLiab, totalAssets, balCols);
  const debtToEquityTrend = buildRatioSeries(totalDebt.length ? totalDebt : totalLiab, totalEquity, balCols);
  const currentRatioTrend = buildRatioSeries(currentAssets, currentLiab, balCols, 1); // ratio not %

  return (
    <div className="p-6 space-y-6">
      {/* Snapshot — anlık değerler */}
      {ratios && (
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">
            Anlık Oranlar
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
              <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-4 py-2.5">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Değerleme</p>
              </div>
              <SnapshotRow label="F/K (P/E)" value={formatRatio(ratios.pe)} />
              <SnapshotRow label="İleri F/K" value={formatRatio(ratios.forwardPE)} />
              <SnapshotRow label="PD/DD (P/B)" value={formatRatio(ratios.pb)} />
              <SnapshotRow label="F/S (P/S)" value={formatRatio(ratios.ps)} />
              <SnapshotRow label="FD/FAVÖK" value={formatRatio(ratios.evEbitda)} />
              <SnapshotRow label="PEG" value={formatRatio(ratios.peg)} />
            </div>
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
              <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-4 py-2.5">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Karlılık & Verimlilik</p>
              </div>
              <SnapshotRow label="Brüt Marj" value={formatPercent(ratios.grossMargin)} />
              <SnapshotRow label="Faaliyet Marjı" value={formatPercent(ratios.operatingMargin)} />
              <SnapshotRow label="Net Marj" value={formatPercent(ratios.netMargin)} />
              <SnapshotRow label="FAVÖK Marjı" value={formatPercent(ratios.ebitdaMargin)} />
              <SnapshotRow label="ROE" value={formatPercent(ratios.roe)} />
              <SnapshotRow label="ROA" value={formatPercent(ratios.roa)} />
            </div>
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
              <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-4 py-2.5">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Borç & Büyüme</p>
              </div>
              <SnapshotRow label="Borç/Özsermaye" value={formatRatio(ratios.debtToEquity)} />
              <SnapshotRow label="Cari Oran" value={formatRatio(ratios.currentRatio)} />
              <SnapshotRow label="Asit-Test" value={formatRatio(ratios.quickRatio)} />
              <SnapshotRow label="Gelir Büyümesi" value={formatPercent(ratios.revenueGrowth)} />
              <SnapshotRow label="Kazanç Büyümesi" value={formatPercent(ratios.earningsGrowth)} />
              <SnapshotRow label="Beta" value={formatRatio(ratios.beta)} />
            </div>
          </div>
        </div>
      )}

      {/* Quarterly trends */}
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider mb-3 font-medium">
          Çeyreklik Trendler
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Aktif Karlılık (ROA)" data={roaTrend} color="var(--chart-gold)" />
          <ChartCard title="Özkaynak Karlılığı (ROE)" data={roeTrend} color="var(--chart-gold)" />
          <ChartCard title="Brüt Kar Marjı" data={grossMarginTrend} color="var(--chart-gold)" />
          <ChartCard title="Esas Faaliyet Kar Marjı" data={opMarginTrend} color="var(--chart-gold)" />
          <ChartCard title="FAVÖK Marjı" data={ebitdaMarginTrend} color="var(--chart-gold)" />
          <ChartCard title="Net Kar Marjı" data={netMarginTrend} color="var(--chart-pink)" />
          <ChartCard title="Borçluluk Oranı (Borç/Aktif)" data={debtToAssetsTrend} color="var(--chart-blue)" />
          <ChartCard title="Borç/Özkaynak Oranı" data={debtToEquityTrend} color="var(--chart-blue)" />
          <ChartCard title="Cari Oran" data={currentRatioTrend} color="var(--chart-blue)" unit="x" />
        </div>
      </div>
    </div>
  );
}
