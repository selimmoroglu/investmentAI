"use client";

import { useEffect, useState } from "react";
import { api, type OHLCVBar, type Technicals } from "@/lib/api";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { RSIMACDChart } from "@/components/charts/RSIMACDChart";

interface TechnicalTabProps {
  ticker: string;
}

type Period = { id: string; label: string; interval: string };

const PERIODS: Period[] = [
  { id: "1mo", label: "1A", interval: "1d" },
  { id: "3mo", label: "3A", interval: "1d" },
  { id: "6mo", label: "6A", interval: "1d" },
  { id: "1y", label: "1Y", interval: "1d" },
  { id: "2y", label: "2Y", interval: "1wk" },
  { id: "5y", label: "5Y", interval: "1wk" },
];

type Overlay = "sma" | "bb";

export function TechnicalTab({ ticker }: TechnicalTabProps) {
  const [period, setPeriod] = useState(PERIODS[2]);
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [technicals, setTechnicals] = useState<Technicals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOverlays, setActiveOverlays] = useState<Set<Overlay>>(new Set(["sma"]));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.history(ticker, period.id, period.interval),
      api.technicals(ticker),
    ])
      .then(([h, t]) => {
        setHistory(h);
        setTechnicals(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker, period]);

  const toggleOverlay = (o: Overlay) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      next.has(o) ? next.delete(o) : next.add(o);
      return next;
    });
  };

  const overlays = technicals
    ? {
        ...(activeOverlays.has("sma") && {
          sma20: technicals.sma20,
          sma50: technicals.sma50,
          sma200: technicals.sma200,
        }),
        ...(activeOverlays.has("bb") && {
          bbUpper: technicals.bbUpper,
          bbMid: technicals.bbMid,
          bbLower: technicals.bbLower,
        }),
      }
    : {};

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period selector */}
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex rounded-lg p-[3px] gap-[2px]"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p)}
              style={{
                background: period.id === p.id ? "var(--bg-card)" : "transparent",
                color: period.id === p.id ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: period.id === p.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Overlay toggles */}
        <div className="flex gap-2">
          {(["sma", "bb"] as Overlay[]).map((o) => (
            <button
              key={o}
              onClick={() => toggleOverlay(o)}
              style={{
                border: "1px solid var(--border)",
                background: activeOverlays.has(o) ? "var(--bg-tertiary)" : "transparent",
                color: activeOverlays.has(o) ? "var(--text-primary)" : "var(--text-muted)",
              }}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
            >
              {o === "sma" ? "SMA 20/50/200" : "Bollinger Bands"}
            </button>
          ))}
        </div>

        {/* Legend */}
        {activeOverlays.has("sma") && (
          <div className="flex gap-3 ml-2">
            {[["#3b82f6", "SMA20"], ["#f59e0b", "SMA50"], ["#ec4899", "SMA200"]].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span style={{ background: color, width: 16, height: 2, display: "inline-block", borderRadius: 1 }} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Candlestick chart */}
      {loading ? (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", height: 420 }}
          className="rounded-xl animate-pulse"
        />
      ) : (
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          className="rounded-xl overflow-hidden"
        >
          <CandlestickChart data={history} overlays={overlays} height={420} />
        </div>
      )}

      {/* RSI + MACD */}
      {technicals && !loading && (
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          className="rounded-xl overflow-hidden p-4"
        >
          <RSIMACDChart
            rsi={technicals.rsi}
            macd={technicals.macd}
            macdSignal={technicals.macdSignal}
            macdHistogram={technicals.macdHistogram}
            height={160}
          />
        </div>
      )}

      {/* Indicator values */}
      {technicals && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "RSI (14)", value: technicals.rsi.at(-1)?.value.toFixed(1) ?? "—", note: (() => {
              const v = technicals.rsi.at(-1)?.value ?? 50;
              return v > 70 ? "Aşırı Alım" : v < 30 ? "Aşırı Satım" : "Nötr";
            })() },
            { label: "MACD", value: technicals.macd.at(-1)?.value.toFixed(2) ?? "—", note: "Son değer" },
            { label: "SMA 20", value: technicals.sma20.at(-1)?.value.toFixed(2) ?? "—", note: "Kısa vadeli" },
            { label: "SMA 200", value: technicals.sma200.at(-1)?.value.toFixed(2) ?? "—", note: "Uzun vadeli" },
          ].map((item) => (
            <div
              key={item.label}
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              className="rounded-xl p-4"
            >
              <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">{item.label}</p>
              <p style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold tabular-nums">{item.value}</p>
              <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{item.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
