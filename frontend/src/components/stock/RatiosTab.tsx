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

type Freq = "annual" | "quarterly";

// Birden fazla olası label denemesi yapar — yfinance versiyon/şirkete göre değişebiliyor
function findValues(stmt: FinancialStatement | null, candidates: string[]): (number | null)[] {
  if (!stmt) return [];
  for (const cand of candidates) {
    const lc = cand.toLowerCase();
    const exact = stmt.rows.find((r) => r.label.toLowerCase() === lc);
    if (exact) return exact.values;
  }
  for (const cand of candidates) {
    const lc = cand.toLowerCase();
    const partial = stmt.rows.find((r) => r.label.toLowerCase().includes(lc));
    if (partial) return partial.values;
  }
  return [];
}

function buildSeries(
  numerator: (number | null)[],
  denominator: (number | null)[],
  cols: string[],
  multiplier = 100
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  const n = Math.min(cols.length, numerator.length, denominator.length);
  for (let i = 0; i < n; i++) {
    const num = numerator[i];
    const den = denominator[i];
    if (num != null && den != null && den !== 0) {
      points.push({ label: cols[i], value: (num / den) * multiplier });
    }
  }
  return points.reverse(); // backend most-recent-first → kronolojik
}

function ChartCard({ title, data, color, unit = "%", subtitle }: {
  title: string;
  data: SeriesPoint[];
  color?: string;
  unit?: string;
  subtitle?: string;
}) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium">{title}</p>
        {subtitle && <p style={{ color: "var(--text-muted)" }} className="text-[10px]">{subtitle}</p>}
      </div>
      {data.length < 2 ? (
        <div style={{ color: "var(--text-muted)", height: 200 }} className="text-[12px] flex items-center justify-center">
          Yeterli veri yok
        </div>
      ) : (
        <LineChart
          data={data}
          color={color || "var(--chart-gold)"}
          height={200}
          unit={unit}
          formatY={(v) => v.toFixed(1) + unit}
        />
      )}
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
  const [incomeA, setIncomeA] = useState<FinancialStatement | null>(null);
  const [balanceQ, setBalanceQ] = useState<FinancialStatement | null>(null);
  const [balanceA, setBalanceA] = useState<FinancialStatement | null>(null);
  const [freq, setFreq] = useState<Freq>("annual");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.ratios(ticker).catch(() => null),
      api.financials(ticker, "income", "quarterly").catch(() => null),
      api.financials(ticker, "income", "annual").catch(() => null),
      api.financials(ticker, "balance", "quarterly").catch(() => null),
      api.financials(ticker, "balance", "annual").catch(() => null),
    ]).then(([r, incQ, incA, balQ, balA]) => {
      setRatios(r);
      setIncomeQ(incQ);
      setIncomeA(incA);
      setBalanceQ(balQ);
      setBalanceA(balA);
    }).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-[200px] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              className="rounded-xl h-[260px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Aktif veri seti (annual veya quarterly)
  const income = freq === "annual" ? incomeA : incomeQ;
  const balance = freq === "annual" ? balanceA : balanceQ;

  const incCols = income?.columns ?? [];
  const balCols = balance?.columns ?? [];

  const revenue = findValues(income, ["Total Revenue", "Operating Revenue", "Revenue"]);
  const grossProfit = findValues(income, ["Gross Profit"]);
  const operatingIncome = findValues(income, ["Operating Income", "Total Operating Income As Reported", "Ebit"]);
  const netIncome = findValues(income, ["Net Income Common Stockholders", "Net Income From Continuing Operation Net Minority Interest", "Net Income"]);
  const ebitda = findValues(income, ["Normalized EBITDA", "EBITDA"]);

  const totalAssets = findValues(balance, ["Total Assets"]);
  const totalLiab = findValues(balance, ["Total Liabilities Net Minority Interest", "Total Liabilities"]);
  const totalEquity = findValues(balance, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"]);
  const totalDebt = findValues(balance, ["Total Debt"]);
  const longTermDebt = findValues(balance, ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"]);
  const currentDebt = findValues(balance, ["Current Debt", "Current Debt And Capital Lease Obligation"]);
  const currentAssets = findValues(balance, ["Current Assets", "Total Current Assets"]);
  const currentLiab = findValues(balance, ["Current Liabilities", "Total Current Liabilities"]);
  const inventory = findValues(balance, ["Inventory"]);

  // Borç toplamı: Total Debt yoksa LT + ST debt
  const debtSeries = totalDebt.length
    ? totalDebt
    : (longTermDebt.length || currentDebt.length)
      ? incCols.map((_, i) => (longTermDebt[i] ?? 0) + (currentDebt[i] ?? 0))
      : [];

  // Quick assets = Current Assets - Inventory
  const quickAssets = currentAssets.length && inventory.length
    ? currentAssets.map((v, i) => (v != null ? v - (inventory[i] ?? 0) : null))
    : currentAssets;

  // Margins (income only)
  const grossMargin = buildSeries(grossProfit, revenue, incCols);
  const opMargin = buildSeries(operatingIncome, revenue, incCols);
  const netMargin = buildSeries(netIncome, revenue, incCols);
  const ebitdaMargin = buildSeries(ebitda.length ? ebitda : operatingIncome, revenue, incCols);

  // ROE/ROA — income & balance kolonları aynı uzunluk değilse min'a göre kes
  const roe = buildSeries(netIncome, totalEquity, balCols);
  const roa = buildSeries(netIncome, totalAssets, balCols);

  // Leverage / liquidity (balance)
  const debtToAssets = buildSeries(debtSeries, totalAssets, balCols);
  const debtToEquity = buildSeries(debtSeries, totalEquity, balCols);
  const liabToAssets = buildSeries(totalLiab, totalAssets, balCols);
  const currentRatio = buildSeries(currentAssets, currentLiab, balCols, 1);
  const quickRatio = buildSeries(quickAssets, currentLiab, balCols, 1);
  const equityRatio = buildSeries(totalEquity, totalAssets, balCols);

  const charts = [
    { title: "Brüt Kar Marjı", data: grossMargin, color: "var(--chart-gold)" },
    { title: "Esas Faaliyet Kar Marjı", data: opMargin, color: "var(--chart-gold)" },
    { title: "FAVÖK Marjı", data: ebitdaMargin, color: "var(--chart-gold)" },
    { title: "Net Kar Marjı", data: netMargin, color: "var(--chart-pink)" },
    { title: "Aktif Karlılık (ROA)", data: roa, color: "var(--chart-gold)" },
    { title: "Özkaynak Karlılığı (ROE)", data: roe, color: "var(--chart-gold)" },
    { title: "Borçluluk Oranı (Borç/Aktif)", data: debtToAssets.length > 1 ? debtToAssets : liabToAssets, color: "var(--chart-blue)", subtitle: debtToAssets.length > 1 ? undefined : "Yükümlülük/Aktif" },
    { title: "Borç/Özkaynak Oranı", data: debtToEquity, color: "var(--chart-blue)" },
    { title: "Özkaynak/Aktif Oranı", data: equityRatio, color: "var(--chart-blue)" },
    { title: "Cari Oran", data: currentRatio, color: "var(--chart-blue)", unit: "x" },
    { title: "Asit-Test (Quick Ratio)", data: quickRatio, color: "var(--chart-blue)", unit: "x" },
  ];

  const trendsAvailable = charts.filter(c => c.data.length >= 2).length;

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

      {/* Trends with freq toggle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium">
            Tarihsel Oran Trendleri
          </p>
          <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 2 }} className="flex gap-[2px]">
            {(["annual", "quarterly"] as Freq[]).map((f) => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                style={{
                  background: freq === f ? "var(--bg-secondary)" : "transparent",
                  color: freq === f ? "var(--text-primary)" : "var(--text-muted)",
                  border: freq === f ? "1px solid var(--border)" : "1px solid transparent",
                }}
                className="px-3 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-all"
              >
                {f === "annual" ? "Yıllık" : "Çeyreklik"}
              </button>
            ))}
          </div>
        </div>

        {trendsAvailable === 0 ? (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-8 text-center">
            <p style={{ color: "var(--text-muted)" }} className="text-[13px]">
              Bu hisse için {freq === "annual" ? "yıllık" : "çeyreklik"} finansal veri yetersiz.
              {freq === "annual" ? " Çeyreklik moda geçmeyi deneyin." : " Yıllık moda geçmeyi deneyin."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map((c) =>
              c.data.length >= 2 && (
                <ChartCard
                  key={c.title}
                  title={c.title}
                  data={c.data}
                  color={c.color}
                  unit={c.unit}
                  subtitle={c.subtitle}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
