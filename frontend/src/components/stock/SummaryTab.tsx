"use client";

import { useEffect, useState } from "react";
import { api, type Quote, type OHLCVBar, type FinancialStatement } from "@/lib/api";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import {
  formatPrice,
  formatVolume,
  formatMarketCap,
  formatRatio,
  formatPercent,
  formatChange,
  changeClass,
} from "@/lib/formatters";

interface SummaryTabProps {
  ticker: string;
}

const PERIODS = [
  { id: "1d", label: "Gün içi", interval: "5m" },
  { id: "5d", label: "1 Hafta", interval: "1h" },
  { id: "1mo", label: "1 Ay", interval: "1d" },
  { id: "6mo", label: "6 Ay", interval: "1d" },
  { id: "1y", label: "1 Yıl", interval: "1d" },
  { id: "5y", label: "Tüm", interval: "1wk" },
];

function QuickStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">{label}</span>
      <span style={{ color: color || "var(--text-primary)" }} className="text-[13px] font-medium tabular-nums mt-0.5">{value}</span>
    </div>
  );
}

function FinSummaryRow({ label, vals, pct }: { label: string; vals: (number | null)[]; pct?: boolean }) {
  const fmt = (v: number | null) => {
    if (v == null) return "—";
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${abs.toFixed(0)}`;
  };
  return (
    <div
      style={{ borderBottom: "1px solid var(--border)" }}
      className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 items-center"
    >
      <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">{label}</span>
      {vals.map((v, i) => (
        <span key={i} style={{ color: "var(--text-primary)" }} className="text-[12px] tabular-nums text-right">{fmt(v)}</span>
      ))}
    </div>
  );
}

export function SummaryTab({ ticker }: SummaryTabProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [income, setIncome] = useState<FinancialStatement | null>(null);
  const [balance, setBalance] = useState<FinancialStatement | null>(null);
  const [period, setPeriod] = useState(PERIODS[3]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.quote(ticker),
      api.financials(ticker, "income", "quarterly"),
      api.financials(ticker, "balance", "quarterly"),
    ]).then(([q, inc, bal]) => {
      setQuote(q);
      setIncome(inc);
      setBalance(bal);
    }).catch(console.error).finally(() => setLoading(false));
  }, [ticker]);

  useEffect(() => {
    setHistLoading(true);
    api.history(ticker, period.id, period.interval)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, [ticker, period]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="h-16 rounded-xl animate-pulse" />
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="h-[400px] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!quote) return <div className="p-6" style={{ color: "var(--text-muted)" }}>Veri alınamadı.</div>;

  // Extract key financial rows (last 3 quarters)
  const getRow = (stmt: FinancialStatement | null, label: string) => {
    const row = stmt?.rows.find(r => r.label.toLowerCase().includes(label.toLowerCase()));
    return row?.values.slice(0, 3) ?? [null, null, null];
  };

  const cols = income?.columns?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col">
      {/* Quick stats bar */}
      <div
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        className="px-5 py-3 flex flex-wrap gap-6"
      >
        <QuickStat label="Önceki Kapanış" value={formatPrice(quote.previousClose, quote.currency)} />
        <QuickStat label="52H Yüksek" value={formatPrice(quote.fiftyTwoWeekHigh, quote.currency)} />
        <QuickStat label="52H Düşük" value={formatPrice(quote.fiftyTwoWeekLow, quote.currency)} />
        <QuickStat label="Hacim" value={formatVolume(quote.volume)} />
        <QuickStat label="Ort. Hacim" value={formatVolume(quote.avgVolume)} />
        <QuickStat label="Piyasa Değeri" value={formatMarketCap(quote.marketCap, quote.currency)} />
        <QuickStat label="F/K" value={formatRatio(quote.pe)} />
        <QuickStat label="HBK" value={formatRatio(quote.eps)} />
      </div>

      {/* Period buttons */}
      <div
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
        className="px-5 py-2.5 flex items-center gap-2 flex-wrap"
      >
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p)}
            style={{
              background: period.id === p.id ? "var(--bg-tertiary)" : "transparent",
              color: period.id === p.id ? "var(--text-primary)" : "var(--text-muted)",
              border: period.id === p.id ? "1px solid var(--border)" : "1px solid transparent",
            }}
            className="px-3 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        {histLoading ? (
          <div style={{ background: "var(--bg-secondary)", height: 380 }} className="animate-pulse" />
        ) : (
          <CandlestickChart data={history} height={380} />
        )}
      </div>

      {/* Financial summary */}
      {(income?.rows.length || balance?.rows.length) ? (
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income summary */}
            {income && income.rows.length > 0 && (
              <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
                <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5"
                >
                  <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Özet Gelir Tablosu</span>
                  {cols.map(c => (
                    <span key={c} style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums text-right">{c}</span>
                  ))}
                </div>
                {[
                  ["Total Revenue", "Toplam Gelir"],
                  ["Gross Profit", "Brüt Kar"],
                  ["Operating Income", "Faaliyet Karı"],
                  ["Net Income", "Net Kar"],
                ].map(([key, label]) => (
                  <FinSummaryRow key={key} label={label} vals={getRow(income, key)} />
                ))}
              </div>
            )}

            {/* Balance summary */}
            {balance && balance.rows.length > 0 && (
              <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
                <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5"
                >
                  <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold">Özet Bilanço</span>
                  {cols.map(c => (
                    <span key={c} style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums text-right">{c}</span>
                  ))}
                </div>
                {[
                  ["Total Assets", "Toplam Varlıklar"],
                  ["Total Debt", "Toplam Borç"],
                  ["Stockholders Equity", "Özsermaye"],
                  ["Cash", "Nakit"],
                ].map(([key, label]) => (
                  <FinSummaryRow key={key} label={label} vals={getRow(balance, key)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Company summary */}
      {quote.summary && (
        <div className="px-5 pb-5">
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-2">Şirket Hakkında</p>
            <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }} className="text-[13px]">{quote.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
