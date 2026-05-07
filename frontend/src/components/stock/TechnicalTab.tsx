"use client";

import { useEffect, useState } from "react";
import { api, type OHLCVBar, type Technicals } from "@/lib/api";
import { CandlestickChart } from "@/components/charts/CandlestickChart";

interface TechnicalTabProps {
  ticker: string;
}

const PERIODS = [
  { id: "3mo", label: "3A", interval: "1d" },
  { id: "6mo", label: "6A", interval: "1d" },
  { id: "1y", label: "1Y", interval: "1d" },
  { id: "2y", label: "2Y", interval: "1wk" },
  { id: "5y", label: "5Y", interval: "1wk" },
];

function formatLevel(v: number) {
  if (v >= 1000) return v.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v.toFixed(2);
}

function SignalBadge({ value }: { value: "Pozitif" | "Negatif" | "Nötr" | null }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    "Pozitif": { color: "var(--up)", bg: "var(--up-bg)", label: "Pozitif Sinyal" },
    "Negatif": { color: "var(--down)", bg: "var(--down-bg)", label: "Negatif Sinyal" },
    "Nötr": { color: "var(--text-secondary)", bg: "var(--bg-tertiary)", label: "Nötr / Karışık" },
  };
  const v = map[value || "Nötr"];
  return (
    <span style={{ background: v.bg, color: v.color }} className="px-3 py-1 rounded-full text-[12px] font-semibold">
      {v.label}
    </span>
  );
}

function TrendBadge({ trend, slope }: { trend: string; slope: number }) {
  const isUp = trend === "Yükseliş";
  const isDown = trend === "Düşüş";
  const color = isUp ? "var(--up)" : isDown ? "var(--down)" : "var(--text-secondary)";
  const bg = isUp ? "var(--up-bg)" : isDown ? "var(--down-bg)" : "var(--bg-tertiary)";
  return (
    <span style={{ background: bg, color }} className="px-3 py-1 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5">
      {isUp ? "↗" : isDown ? "↘" : "→"} {trend}
      <span style={{ opacity: 0.7 }} className="text-[10px]">
        ({slope >= 0 ? "+" : ""}{slope.toFixed(2)}%/gün)
      </span>
    </span>
  );
}

interface InsightProps { title: string; value: string; tone?: "good" | "bad" | "neutral"; description?: string }
function Insight({ title, value, tone = "neutral", description }: InsightProps) {
  const color = tone === "good" ? "var(--up)" : tone === "bad" ? "var(--down)" : "var(--text-primary)";
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">{title}</p>
      <p style={{ color }} className="text-[15px] font-semibold tabular-nums">{value}</p>
      {description && (
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1.5 leading-snug">{description}</p>
      )}
    </div>
  );
}

export function TechnicalTab({ ticker }: TechnicalTabProps) {
  const [period, setPeriod] = useState(PERIODS[2]); // 1Y
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [tech, setTech] = useState<Technicals | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChannel, setShowChannel] = useState(true);
  const [showSupRes, setShowSupRes] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.history(ticker, period.id, period.interval),
      api.technicals(ticker),
    ])
      .then(([h, t]) => {
        setHistory(h);
        setTech(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker, period]);

  // Price lines for support/resistance
  const priceLines = tech && showSupRes ? [
    ...tech.support.map((p, i) => ({
      price: p,
      color: "#22c55e",
      title: i === 0 ? `Destek 1: ${formatLevel(p)}` : `Destek ${i + 1}`,
    })),
    ...tech.resistance.map((p, i) => ({
      price: p,
      color: "#ef4444",
      title: i === 0 ? `Direnç 1: ${formatLevel(p)}` : `Direnç ${i + 1}`,
    })),
  ] : [];

  const overlays = tech && showChannel ? {
    channelMid: tech.channelMid,
    channelUpper: tech.channelUpper,
    channelLower: tech.channelLower,
  } : {};

  if (loading || !tech) {
    return (
      <div className="p-6 space-y-4">
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-[120px] animate-pulse" />
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-[420px] animate-pulse" />
      </div>
    );
  }

  const { summary } = tech;
  const sma50Val = tech.sma50.at(-1)?.value;
  const sma200Val = tech.sma200.at(-1)?.value;

  return (
    <div className="p-5 space-y-5 max-w-[1200px]">
      {/* Genel sinyal kartı */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-2">Genel Teknik Görünüm</p>
            <div className="flex items-center gap-3 flex-wrap">
              <SignalBadge value={summary.overall} />
              <TrendBadge trend={tech.trend} slope={tech.trendSlopePct} />
            </div>
          </div>
          <div className="text-right">
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">Güncel Fiyat</p>
            <p style={{ color: "var(--text-primary)" }} className="text-[24px] font-bold tabular-nums">
              {formatLevel(tech.currentPrice)}
            </p>
          </div>
        </div>

        <p style={{ color: "var(--text-secondary)" }} className="text-[12px] leading-relaxed mt-4">
          {summary.overall === "Pozitif" && "Hareketli ortalamalar, RSI ve MACD birlikte pozitif yönde sinyal veriyor."}
          {summary.overall === "Negatif" && "Hareketli ortalamalar ve momentum göstergeleri zayıflık gösteriyor."}
          {summary.overall === "Nötr" && "Göstergeler karışık sinyaller veriyor — net bir yön yok."}
        </p>
      </div>

      {/* Period + overlays toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p)}
              style={{
                background: period.id === p.id ? "var(--bg-tertiary)" : "transparent",
                color: period.id === p.id ? "var(--text-primary)" : "var(--text-muted)",
                border: period.id === p.id ? "1px solid var(--border)" : "1px solid transparent",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSupRes((v) => !v)}
          style={{
            border: "1px solid var(--border)",
            background: showSupRes ? "var(--bg-tertiary)" : "transparent",
            color: showSupRes ? "var(--text-primary)" : "var(--text-muted)",
          }}
          className="px-3 py-1 rounded-lg text-[11px] font-medium cursor-pointer"
        >
          Destek/Direnç
        </button>
        <button
          onClick={() => setShowChannel((v) => !v)}
          style={{
            border: "1px solid var(--border)",
            background: showChannel ? "var(--bg-tertiary)" : "transparent",
            color: showChannel ? "var(--text-primary)" : "var(--text-muted)",
          }}
          className="px-3 py-1 rounded-lg text-[11px] font-medium cursor-pointer"
        >
          Trend Kanalı
        </button>
      </div>

      {/* Chart */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
        <CandlestickChart data={history} overlays={overlays} priceLines={priceLines} height={420} />
      </div>

      {/* Destek / Direnç kartı */}
      {(tech.support.length > 0 || tech.resistance.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ background: "var(--up)", width: 8, height: 8, borderRadius: "50%" }} />
              <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Destek Seviyeleri</p>
            </div>
            {tech.support.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Belirgin destek noktası bulunmuyor.</p>
            ) : (
              <div className="space-y-2">
                {tech.support.map((p, i) => {
                  const dist = ((p / tech.currentPrice) - 1) * 100;
                  return (
                    <div key={i} className="flex items-center justify-between" style={{ borderBottom: i < tech.support.length - 1 ? "1px solid var(--border)" : "none", paddingBottom: 6 }}>
                      <div>
                        <p style={{ color: "var(--text-secondary)" }} className="text-[12px]">Destek {i + 1}</p>
                        <p style={{ color: "var(--text-muted)" }} className="text-[10px]">{dist.toFixed(2)}% uzakta</p>
                      </div>
                      <p style={{ color: "var(--up)" }} className="text-[14px] font-semibold tabular-nums">{formatLevel(p)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3 leading-snug">
              Fiyatın aşağıda zorlandığı seviyeler. Bu noktalardan tekrar yukarı tepki bekleniyor.
            </p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ background: "var(--down)", width: 8, height: 8, borderRadius: "50%" }} />
              <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Direnç Seviyeleri</p>
            </div>
            {tech.resistance.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Belirgin direnç noktası bulunmuyor.</p>
            ) : (
              <div className="space-y-2">
                {tech.resistance.map((p, i) => {
                  const dist = ((p / tech.currentPrice) - 1) * 100;
                  return (
                    <div key={i} className="flex items-center justify-between" style={{ borderBottom: i < tech.resistance.length - 1 ? "1px solid var(--border)" : "none", paddingBottom: 6 }}>
                      <div>
                        <p style={{ color: "var(--text-secondary)" }} className="text-[12px]">Direnç {i + 1}</p>
                        <p style={{ color: "var(--text-muted)" }} className="text-[10px]">+{dist.toFixed(2)}% yukarıda</p>
                      </div>
                      <p style={{ color: "var(--down)" }} className="text-[14px] font-semibold tabular-nums">{formatLevel(p)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3 leading-snug">
              Fiyatın yukarı çıkmakta zorlandığı seviyeler. Bu noktaları kırmak için hacim gerekir.
            </p>
          </div>
        </div>
      )}

      {/* Basit yorum kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Insight
          title="Trend Yönü"
          value={tech.trend}
          tone={tech.trend === "Yükseliş" ? "good" : tech.trend === "Düşüş" ? "bad" : "neutral"}
          description={`Son 50 günün eğimi: ${tech.trendSlopePct >= 0 ? "+" : ""}${tech.trendSlopePct.toFixed(2)}%/gün`}
        />
        <Insight
          title="RSI (14)"
          value={summary.rsi != null ? summary.rsi.toFixed(1) : "—"}
          tone={summary.rsiLabel === "Aşırı Alım" ? "bad" : summary.rsiLabel === "Aşırı Satım" ? "good" : "neutral"}
          description={
            summary.rsiLabel === "Aşırı Alım"
              ? "70 üstü — kar realizasyonu riski"
              : summary.rsiLabel === "Aşırı Satım"
                ? "30 altı — toparlama fırsatı"
                : "30-70 arası nötr bölge"
          }
        />
        <Insight
          title="50 Günlük Ortalama"
          value={summary.priceVsSMA50 != null ? `${summary.priceVsSMA50 >= 0 ? "+" : ""}${summary.priceVsSMA50.toFixed(2)}%` : "—"}
          tone={summary.priceVsSMA50 != null && summary.priceVsSMA50 >= 0 ? "good" : "bad"}
          description={
            summary.priceVsSMA50 != null
              ? `Fiyat 50 günlük ort. (${sma50Val ? formatLevel(sma50Val) : "—"}) ${summary.priceVsSMA50 >= 0 ? "üstünde" : "altında"}`
              : undefined
          }
        />
        <Insight
          title="200 Günlük Ortalama"
          value={summary.priceVsSMA200 != null ? `${summary.priceVsSMA200 >= 0 ? "+" : ""}${summary.priceVsSMA200.toFixed(2)}%` : "—"}
          tone={summary.priceVsSMA200 != null && summary.priceVsSMA200 >= 0 ? "good" : "bad"}
          description={
            summary.priceVsSMA200 != null
              ? `Uzun vadeli trend ${summary.priceVsSMA200 >= 0 ? "pozitif" : "negatif"} (200g: ${sma200Val ? formatLevel(sma200Val) : "—"})`
              : undefined
          }
        />
      </div>

      {/* Golden cross / death cross + MACD özet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Insight
          title={summary.goldenCross ? "Altın Çapraz (Golden Cross)" : "Ölüm Çaprazı (Death Cross)"}
          value={summary.goldenCross ? "Aktif ✓" : "Yok"}
          tone={summary.goldenCross ? "good" : "bad"}
          description={
            summary.goldenCross
              ? "50 günlük ortalama, 200 günlük ortalamanın üstünde — uzun vadeli yükseliş trendi."
              : "50 günlük ortalama, 200 günlük ortalamanın altında — uzun vadeli zayıflık."
          }
        />
        <Insight
          title="MACD Sinyali"
          value={summary.macdSignal || "—"}
          tone={summary.macdSignal === "Pozitif" ? "good" : summary.macdSignal === "Negatif" ? "bad" : "neutral"}
          description={
            summary.macdSignal === "Pozitif"
              ? "Momentum yukarı yönde — kısa vadeli alım baskın."
              : summary.macdSignal === "Negatif"
                ? "Momentum aşağı yönde — kısa vadeli satım baskın."
                : undefined
          }
        />
      </div>

      {/* Bilgi notu */}
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] leading-relaxed">
          <strong style={{ color: "var(--text-secondary)" }}>Not:</strong> Teknik analiz geçmiş fiyat verilerine dayanır ve gelecek performansı garanti etmez.
          Yatırım kararlarında temel analiz ile birlikte değerlendirilmesi önerilir. Destek/direnç seviyeleri son 6 ayın swing high/low noktalarından hesaplanır.
        </p>
      </div>
    </div>
  );
}
