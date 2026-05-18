"use client";

import { useEffect, useState } from "react";
import { api, type OHLCVBar, type Technicals } from "@/lib/api";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { RSIMACDChart } from "@/components/charts/RSIMACDChart";
import { TrendingUp, TrendingDown, Minus, Activity, BarChart2, Target } from "lucide-react";

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

function fmt(v: number) {
  if (v >= 1000) return v.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v.toFixed(2);
}

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function OverallBadge({ value }: { value: "Pozitif" | "Negatif" | "Nötr" | null }) {
  const cfg = {
    "Pozitif": { color: "var(--up)", bg: "var(--up-bg)", icon: <TrendingUp size={12} strokeWidth={2.5} /> },
    "Negatif": { color: "var(--down)", bg: "var(--down-bg)", icon: <TrendingDown size={12} strokeWidth={2.5} /> },
    "Nötr": { color: "var(--text-secondary)", bg: "var(--bg-tertiary)", icon: <Minus size={12} strokeWidth={2.5} /> },
  };
  const v = cfg[value || "Nötr"];
  return (
    <span style={{ background: v.bg, color: v.color, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
      {v.icon} {value || "Nötr"}
    </span>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "var(--up)" : tone === "bad" ? "var(--down)" : "var(--text-primary)";
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <p style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</p>
      <p style={{ color, fontSize: 14, fontWeight: 700 }} className="tabular-nums">{value}</p>
    </div>
  );
}

function MARow({ label, maVal, currentPrice }: { label: string; maVal: number | undefined; currentPrice: number }) {
  if (maVal == null) return null;
  const dev = ((currentPrice / maVal) - 1) * 100;
  const above = dev >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 11, width: 54, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, flex: 1 }} className="tabular-nums">{fmt(maVal)}</span>
      <span
        style={{
          background: above ? "var(--up-bg)" : "var(--down-bg)",
          color: above ? "var(--up)" : "var(--down)",
          fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
        }}
        className="tabular-nums"
      >
        {fmtPct(dev)}
      </span>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: above ? "var(--up)" : "var(--down)", flexShrink: 0 }} />
    </div>
  );
}

function BBRangeBar({ lower, upper, mid, current }: { lower: number; upper: number; mid: number; current: number }) {
  const range = upper - lower;
  if (range <= 0) return null;
  const pct = Math.max(0, Math.min(100, ((current - lower) / range) * 100));
  const midPct = ((mid - lower) / range) * 100;
  const color = pct > 80 ? "var(--down)" : pct < 20 ? "var(--up)" : "var(--warn)";
  return (
    <div className="relative" style={{ height: 6, background: "var(--bg-tertiary)", borderRadius: 3, marginTop: 6 }}>
      <div style={{ position: "absolute", left: `${midPct}%`, top: -2, bottom: -2, width: 1, background: "var(--border)", opacity: 0.7 }} />
      <div style={{ position: "absolute", left: `${pct}%`, top: -3, width: 12, height: 12, borderRadius: "50%", background: color, transform: "translateX(-50%)", border: "2px solid var(--bg-card)", transition: "left 0.3s ease" }} />
    </div>
  );
}

function SRBar({ level, current, type }: { level: number; current: number; type: "support" | "resistance" }) {
  const dist = ((level / current) - 1) * 100;
  const absPct = Math.min(Math.abs(dist), 30);
  const barWidth = (absPct / 30) * 100;
  const color = type === "support" ? "var(--up)" : "var(--down)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, width: 80, flexShrink: 0 }} className="tabular-nums">{fmt(level)}</span>
      <div style={{ flex: 1, height: 4, background: "var(--bg-tertiary)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${barWidth}%`, height: "100%", background: color, borderRadius: 2, opacity: 0.7 }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 600, width: 60, textAlign: "right", flexShrink: 0 }} className="tabular-nums">
        {dist >= 0 ? "+" : ""}{dist.toFixed(1)}%
      </span>
    </div>
  );
}

export function TechnicalTab({ ticker }: TechnicalTabProps) {
  const [period, setPeriod] = useState(PERIODS[2]);
  const [history, setHistory] = useState<OHLCVBar[]>([]);
  const [tech, setTech] = useState<Technicals | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChannel, setShowChannel] = useState(true);
  const [showSupRes, setShowSupRes] = useState(true);
  const [showMAs, setShowMAs] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.history(ticker, period.id, period.interval),
      api.technicals(ticker),
    ])
      .then(([h, t]) => { setHistory(h); setTech(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker, period]);

  if (loading || !tech) {
    return (
      <div className="p-5 space-y-4">
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, height: 80 }} className="animate-pulse" />
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, height: 420 }} className="animate-pulse" />
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, height: 160 }} className="animate-pulse" />
      </div>
    );
  }

  const { summary } = tech;
  const sma20Val = tech.sma20.at(-1)?.value;
  const sma50Val = tech.sma50.at(-1)?.value;
  const sma200Val = tech.sma200.at(-1)?.value;
  const ema12Val = tech.ema12.at(-1)?.value;
  const ema26Val = tech.ema26.at(-1)?.value;
  const bbUpperVal = tech.bbUpper.at(-1)?.value;
  const bbLowerVal = tech.bbLower.at(-1)?.value;
  const bbMidVal = tech.bbMid.at(-1)?.value;
  const macdLastVal = tech.macd.at(-1)?.value;
  const macdSignalLastVal = tech.macdSignal.at(-1)?.value;
  const rsiLastVal = tech.rsi.at(-1)?.value;

  const bbWidth = bbUpperVal != null && bbLowerVal != null && bbMidVal != null && bbMidVal > 0
    ? ((bbUpperVal - bbLowerVal) / bbMidVal) * 100
    : null;
  const bbPosition = bbUpperVal != null && bbLowerVal != null
    ? ((tech.currentPrice - bbLowerVal) / (bbUpperVal - bbLowerVal)) * 100
    : null;

  const priceLines = showSupRes ? [
    ...tech.support.map((p, i) => ({ price: p, color: "#22c55e", title: `Destek ${i + 1}` })),
    ...tech.resistance.map((p, i) => ({ price: p, color: "#ef4444", title: `Direnç ${i + 1}` })),
  ] : [];

  const overlays: Record<string, { time: number; value: number }[]> = {};
  if (showChannel) {
    if (tech.channelMid.length) overlays.channelMid = tech.channelMid;
    if (tech.channelUpper.length) overlays.channelUpper = tech.channelUpper;
    if (tech.channelLower.length) overlays.channelLower = tech.channelLower;
  }
  if (showMAs) {
    if (sma20Val != null) overlays.sma20 = tech.sma20;
    if (sma50Val != null) overlays.sma50 = tech.sma50;
    if (sma200Val != null) overlays.sma200 = tech.sma200;
  }

  const rsiTone = rsiLastVal != null ? (rsiLastVal > 70 ? "bad" : rsiLastVal < 30 ? "good" : "neutral") : "neutral";
  const macdTone = summary.macdSignal === "Pozitif" ? "good" : summary.macdSignal === "Negatif" ? "bad" : "neutral";

  return (
    <div className="p-5 space-y-4 max-w-[1200px]">
      {/* Özet sinyal şeridi */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Genel Görünüm</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <OverallBadge value={summary.overall} />
              <span
                style={{
                  background: tech.trend === "Yükseliş" ? "var(--up-bg)" : tech.trend === "Düşüş" ? "var(--down-bg)" : "var(--bg-tertiary)",
                  color: tech.trend === "Yükseliş" ? "var(--up)" : tech.trend === "Düşüş" ? "var(--down)" : "var(--text-secondary)",
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                {tech.trend === "Yükseliş" ? "↗" : tech.trend === "Düşüş" ? "↘" : "→"} {tech.trend}
                <span style={{ opacity: 0.7 }}>({tech.trendSlopePct >= 0 ? "+" : ""}{tech.trendSlopePct.toFixed(2)}%/gün)</span>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, flex: 1, flexWrap: "wrap" }}>
            <MiniStat
              label="Güncel Fiyat"
              value={fmt(tech.currentPrice)}
            />
            <MiniStat
              label="RSI (14)"
              value={rsiLastVal != null ? rsiLastVal.toFixed(1) : "—"}
              tone={rsiTone}
            />
            <MiniStat
              label="MACD"
              value={macdLastVal != null ? (macdLastVal >= 0 ? "+" : "") + macdLastVal.toFixed(2) : "—"}
              tone={macdTone}
            />
            <MiniStat
              label="SMA 50"
              value={summary.priceVsSMA50 != null ? fmtPct(summary.priceVsSMA50) : "—"}
              tone={summary.priceVsSMA50 != null ? (summary.priceVsSMA50 >= 0 ? "good" : "bad") : "neutral"}
            />
            <MiniStat
              label="SMA 200"
              value={summary.priceVsSMA200 != null ? fmtPct(summary.priceVsSMA200) : "—"}
              tone={summary.priceVsSMA200 != null ? (summary.priceVsSMA200 >= 0 ? "good" : "bad") : "neutral"}
            />
            <MiniStat
              label="Golden Cross"
              value={summary.goldenCross ? "Aktif ✓" : "Yok"}
              tone={summary.goldenCross ? "good" : "bad"}
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", padding: 3, gap: 2 }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p)}
              style={{
                background: period.id === p.id ? "var(--accent-primary)" : "transparent",
                color: period.id === p.id ? "#fff" : "var(--text-muted)",
                border: "none", borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {[
          { label: "Destek/Direnç", state: showSupRes, set: setShowSupRes },
          { label: "Trend Kanalı", state: showChannel, set: setShowChannel },
          { label: "Ort. Çizgiler", state: showMAs, set: setShowMAs },
        ].map(({ label, state, set }) => (
          <button
            key={label}
            onClick={() => set((v) => !v)}
            style={{
              border: `1px solid ${state ? "var(--accent-primary)" : "var(--border)"}`,
              background: state ? "var(--accent-muted)" : "transparent",
              color: state ? "var(--accent-primary)" : "var(--text-muted)",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mum grafik */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <CandlestickChart data={history} overlays={overlays} priceLines={priceLines} height={400} />
      </div>

      {/* RSI + MACD alt grafikler */}
      {tech.rsi.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Activity size={14} color="var(--accent-primary)" strokeWidth={2} />
            <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Momentum Göstergeleri</span>
          </div>

          {/* RSI okunabilir bilgi */}
          {rsiLastVal != null && (
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>RSI:</span>
                <span style={{
                  fontWeight: 700, fontSize: 13,
                  color: rsiLastVal > 70 ? "var(--down)" : rsiLastVal < 30 ? "var(--up)" : "var(--text-primary)",
                }} className="tabular-nums">{rsiLastVal.toFixed(1)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5,
                  background: rsiLastVal > 70 ? "var(--down-bg)" : rsiLastVal < 30 ? "var(--up-bg)" : "var(--bg-tertiary)",
                  color: rsiLastVal > 70 ? "var(--down)" : rsiLastVal < 30 ? "var(--up)" : "var(--text-muted)",
                }}>
                  {rsiLastVal > 70 ? "Aşırı Alım" : rsiLastVal < 30 ? "Aşırı Satım" : "Nötr Bölge"}
                </span>
              </div>
              {macdLastVal != null && macdSignalLastVal != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>MACD:</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: macdLastVal >= macdSignalLastVal ? "var(--up)" : "var(--down)" }} className="tabular-nums">
                    {macdLastVal >= 0 ? "+" : ""}{macdLastVal.toFixed(3)}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Sinyal: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }} className="tabular-nums">{macdSignalLastVal.toFixed(3)}</span></span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5,
                    background: macdLastVal >= macdSignalLastVal ? "var(--up-bg)" : "var(--down-bg)",
                    color: macdLastVal >= macdSignalLastVal ? "var(--up)" : "var(--down)",
                  }}>
                    {macdLastVal >= macdSignalLastVal ? "Alım Sinyali" : "Satım Sinyali"}
                  </span>
                </div>
              )}
            </div>
          )}

          <RSIMACDChart
            rsi={tech.rsi}
            macd={tech.macd}
            macdSignal={tech.macdSignal}
            macdHistogram={tech.macdHistogram}
            height={120}
          />
        </div>
      )}

      {/* MA Tablosu + Bollinger Bands — 2 sütun */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Hareketli Ortalamalar */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <BarChart2 size={14} color="var(--accent-primary)" strokeWidth={2} />
            <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Hareketli Ortalamalar</span>
          </div>
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <MARow label="SMA 20" maVal={sma20Val} currentPrice={tech.currentPrice} />
            <MARow label="SMA 50" maVal={sma50Val} currentPrice={tech.currentPrice} />
            <MARow label="SMA 200" maVal={sma200Val} currentPrice={tech.currentPrice} />
            <MARow label="EMA 12" maVal={ema12Val} currentPrice={tech.currentPrice} />
            <MARow label="EMA 26" maVal={ema26Val} currentPrice={tech.currentPrice} />
          </div>
          <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--bg-tertiary)", borderRadius: 8 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.5 }}>
              {summary.goldenCross
                ? "✓ Golden Cross aktif — SMA 50, SMA 200 üzerinde (uzun vadeli yükseliş sinyali)"
                : "✗ Death Cross — SMA 50, SMA 200 altında (uzun vadeli zayıflık sinyali)"}
            </p>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <Target size={14} color="var(--accent-primary)" strokeWidth={2} />
            <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Bollinger Bantları</span>
          </div>

          {bbUpperVal != null && bbLowerVal != null && bbMidVal != null ? (
            <div className="space-y-3">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                {[
                  { label: "Üst Bant", val: bbUpperVal, color: "var(--down)" },
                  { label: "Orta (SMA 20)", val: bbMidVal, color: "var(--text-secondary)" },
                  { label: "Alt Bant", val: bbLowerVal, color: "var(--up)" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center", flex: 1 }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                    <p style={{ color, fontSize: 12, fontWeight: 700, marginTop: 2 }} className="tabular-nums">{fmt(val)}</p>
                  </div>
                ))}
              </div>

              {bbPosition != null && (
                <>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>Fiyat konumu</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: bbPosition > 80 ? "var(--down)" : bbPosition < 20 ? "var(--up)" : "var(--text-primary)",
                      }} className="tabular-nums">{bbPosition.toFixed(0)}%</span>
                    </div>
                    <BBRangeBar lower={bbLowerVal} upper={bbUpperVal} mid={bbMidVal} current={tech.currentPrice} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ color: "var(--up)", fontSize: 9 }}>Alt Bant</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 9 }}>Orta</span>
                      <span style={{ color: "var(--down)", fontSize: 9 }}>Üst Bant</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {bbWidth != null && (
                      <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: 8, padding: "7px 10px" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: 9, textTransform: "uppercase" }}>Bant Genişliği</p>
                        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700, marginTop: 2 }} className="tabular-nums">{bbWidth.toFixed(1)}%</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 9, marginTop: 2 }}>
                          {bbWidth < 5 ? "Sıkışma — kırılım beklenebilir" : bbWidth > 15 ? "Yüksek volatilite" : "Normal aralık"}
                        </p>
                      </div>
                    )}
                    <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: 8, padding: "7px 10px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 9, textTransform: "uppercase" }}>Sinyal</p>
                      <p style={{
                        fontSize: 12, fontWeight: 700, marginTop: 2,
                        color: bbPosition > 80 ? "var(--down)" : bbPosition < 20 ? "var(--up)" : "var(--text-secondary)",
                      }}>
                        {bbPosition > 80 ? "Üst bandına yakın" : bbPosition < 20 ? "Alt bandına yakın" : "Orta bölge"}
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: 9, marginTop: 2 }}>
                        {bbPosition > 80 ? "Aşırı alım olabilir" : bbPosition < 20 ? "Toparlama fırsatı" : "Net sinyal yok"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Bollinger Bant verisi hesaplanamadı.</p>
          )}
        </div>
      </div>

      {/* Destek / Direnç */}
      {(tech.support.length > 0 || tech.resistance.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--up)" }} />
              <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Destek Seviyeleri</span>
            </div>
            {tech.support.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Belirgin destek noktası yok.</p>
              : tech.support.map((p, i) => <SRBar key={i} level={p} current={tech.currentPrice} type="support" />)
            }
            <p style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 8 }}>Son 6 ayın swing low noktaları · Bar genişliği uzaklıkla orantılı</p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--down)" }} />
              <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Direnç Seviyeleri</span>
            </div>
            {tech.resistance.length === 0
              ? <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Belirgin direnç noktası yok.</p>
              : tech.resistance.map((p, i) => <SRBar key={i} level={p} current={tech.currentPrice} type="resistance" />)
            }
            <p style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 8 }}>Son 6 ayın swing high noktaları · Bu seviyeleri kırmak için hacim gerekir</p>
          </div>
        </div>
      )}

      {/* Not */}
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-secondary)" }}>Not:</strong> Teknik analiz geçmiş fiyat hareketlerine dayalıdır ve geleceği garanti etmez.
          RSI hesaplaması 14 günlük, MACD 12/26/9 parametreli, Bollinger Bantları 20 günlük SMA ±2 standart sapma.
          Temel analizle birlikte değerlendirilmesi önerilir.
        </p>
      </div>
    </div>
  );
}
