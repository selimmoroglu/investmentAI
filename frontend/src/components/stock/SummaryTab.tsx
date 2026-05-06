"use client";

import { useEffect, useState } from "react";
import { api, type Quote } from "@/lib/api";
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

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      className="rounded-xl p-4"
    >
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">
        {label}
      </p>
      <p style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold tabular-nums">
        {value}
      </p>
      {sub && (
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

export function SummaryTab({ ticker }: SummaryTabProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.quote(ticker)
      .then(setQuote)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            className="rounded-xl p-4 h-[72px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
        Veri alınamadı.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Price section */}
      <div
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        className="rounded-xl p-5 flex flex-wrap items-start gap-6"
      >
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">
            Güncel Fiyat
          </p>
          <p style={{ color: "var(--text-primary)" }} className="text-3xl font-bold tabular-nums">
            {formatPrice(quote.currentPrice, quote.currency)}
          </p>
          <p className={`text-[14px] font-medium mt-1 tabular-nums ${changeClass(quote.changePercent)}`}>
            {formatChange(quote.changePercent)} ({quote.change != null ? (quote.change >= 0 ? "+" : "") + quote.change.toFixed(2) : "—"})
          </p>
        </div>

        <div className="flex gap-8">
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">52H Yüksek</p>
            <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-medium tabular-nums">
              {formatPrice(quote.fiftyTwoWeekHigh, quote.currency)}
            </p>
          </div>
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">52H Düşük</p>
            <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-medium tabular-nums">
              {formatPrice(quote.fiftyTwoWeekLow, quote.currency)}
            </p>
          </div>
        </div>

        <div className="ml-auto text-right">
          <p style={{ color: "var(--text-muted)" }} className="text-[12px]">
            {quote.exchange}
          </p>
          <p style={{ color: "var(--text-muted)" }} className="text-[12px]">
            {quote.sector} · {quote.industry}
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Piyasa Değeri" value={formatMarketCap(quote.marketCap, quote.currency)} />
        <MetricCard label="Hacim" value={formatVolume(quote.volume)} sub={`Ort: ${formatVolume(quote.avgVolume)}`} />
        <MetricCard label="F/K Oranı" value={formatRatio(quote.pe)} sub={`İleri F/K: ${formatRatio(quote.forwardPE)}`} />
        <MetricCard label="HBK (EPS)" value={formatRatio(quote.eps)} />
        <MetricCard label="Temettü Getirisi" value={formatPercent(quote.dividendYield)} />
        <MetricCard label="Beta" value={formatRatio(quote.beta)} />
        <MetricCard label="Önceki Kapanış" value={formatPrice(quote.previousClose, quote.currency)} />
        <MetricCard label="Para Birimi" value={quote.currency ?? "—"} />
      </div>

      {/* Company summary */}
      {quote.summary && (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="rounded-xl p-5"
        >
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-2">
            Şirket Hakkında
          </p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }} className="text-[13px]">
            {quote.summary}
          </p>
        </div>
      )}
    </div>
  );
}
