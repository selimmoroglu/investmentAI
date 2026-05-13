"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type IndexAnalysis, type IndexQuote } from "@/lib/api";
import { LineChart } from "@/components/charts/LineChart";
import { changeClass, formatChange } from "@/lib/formatters";
import { ArrowLeft, Sun, Moon } from "lucide-react";

const GROUP_LABELS: Record<string, string> = {
  index: "Borsa Endeksleri",
  fx: "Döviz",
  commodity: "Emtia",
  crypto: "Kripto",
};

function formatPrice(v: number, ticker: string): string {
  const dec = ticker === "BTC-USD" ? 0 : ticker.endsWith("=X") ? 4 : 2;
  return v.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const VALUATION_COLORS: Record<string, { color: string; bg: string }> = {
  up: { color: "var(--up)", bg: "var(--up-bg)" },
  "warn-good": { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
  neutral: { color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  warn: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
  down: { color: "var(--down)", bg: "var(--down-bg)" },
};

export default function IndicesAnalysisPage() {
  const { theme, toggle } = useTheme();
  const [list, setList] = useState<IndexQuote[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<IndexAnalysis | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    api.indices()
      .then((d) => {
        setList(d);
        if (d.length > 0 && !selectedTicker) setSelectedTicker(d[0].ticker);
      })
      .catch(console.error)
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTicker) return;
    setLoadingAnalysis(true);
    setAnalysis(null);
    api.indexAnalysis(selectedTicker)
      .then(setAnalysis)
      .catch(console.error)
      .finally(() => setLoadingAnalysis(false));
  }, [selectedTicker]);

  const grouped = list.reduce<Record<string, IndexQuote[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const currentQuote = list.find((q) => q.ticker === selectedTicker);
  const valColors = analysis ? VALUATION_COLORS[analysis.valuationColor] : VALUATION_COLORS.neutral;

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">
      {/* Header */}
      <header
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4"
      >
        <Link href="/" style={{ color: "var(--text-muted)" }} className="flex items-center gap-2 text-[13px] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={14} strokeWidth={1.8} />
          InvestmentAI
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Endeks Analizleri</span>

        <button onClick={toggle} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
          aria-label="Tema değiştir"
        >
          {theme === "dark" ? <Sun size={13} strokeWidth={1.8} /> : <Moon size={13} strokeWidth={1.8} />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left list */}
        <aside style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)", width: 240, minWidth: 240 }} className="flex flex-col overflow-hidden">
          <div style={{ borderBottom: "1px solid var(--border)" }} className="px-4 py-3">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-medium">Endeksler</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: "var(--bg-secondary)", margin: "6px 8px" }} className="h-[44px] rounded-lg animate-pulse" />
              ))
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-2">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider px-4 py-1.5 font-semibold">
                    {GROUP_LABELS[group] || group}
                  </p>
                  {items.map((item) => {
                    const isActive = selectedTicker === item.ticker;
                    const isUp = (item.changePercent ?? 0) >= 0;
                    return (
                      <button
                        key={item.ticker}
                        onClick={() => setSelectedTicker(item.ticker)}
                        style={{
                          background: isActive ? "var(--bg-tertiary)" : "transparent",
                          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          borderLeft: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 text-left cursor-pointer hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all"
                      >
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold truncate">{item.label}</p>
                          <p style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">
                            {item.price != null ? formatPrice(item.price, item.ticker) : "—"}
                          </p>
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums shrink-0 ml-2 ${changeClass(item.changePercent)}`}>
                          {formatChange(item.changePercent)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main analysis */}
        <main className="flex-1 overflow-y-auto p-6 max-w-[1200px]">
          {loadingAnalysis || !analysis ? (
            <div className="space-y-4">
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-[140px] animate-pulse" />
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl h-[300px] animate-pulse" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Hero */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-1">{GROUP_LABELS[analysis.group]}</p>
                    <h1 style={{ color: "var(--text-primary)" }} className="text-[26px] font-bold tracking-tight">{analysis.label}</h1>
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{analysis.ticker}</p>
                  </div>
                  <div className="text-right">
                    <p style={{ color: "var(--text-primary)" }} className="text-[28px] font-bold tabular-nums leading-tight">
                      {formatPrice(analysis.currentPrice, analysis.ticker)}
                    </p>
                    {currentQuote?.changePercent != null && (
                      <span
                        style={{ background: (currentQuote.changePercent ?? 0) >= 0 ? "var(--up-bg)" : "var(--down-bg)" }}
                        className={`mt-1 inline-block px-2 py-0.5 rounded text-[12px] font-medium tabular-nums ${changeClass(currentQuote.changePercent)}`}
                      >
                        {formatChange(currentQuote.changePercent)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Valuation + trend chips */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <span style={{ background: valColors.bg, color: valColors.color }} className="px-3 py-1.5 rounded-full text-[12px] font-bold">
                    Değerleme: {analysis.valuation}
                  </span>
                  <span
                    style={{
                      background: analysis.trend === "Yükseliş" ? "var(--up-bg)" : analysis.trend === "Düşüş" ? "var(--down-bg)" : "var(--bg-tertiary)",
                      color: analysis.trend === "Yükseliş" ? "var(--up)" : analysis.trend === "Düşüş" ? "var(--down)" : "var(--text-secondary)",
                    }}
                    className="px-3 py-1.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5"
                  >
                    {analysis.trend === "Yükseliş" ? "↗" : analysis.trend === "Düşüş" ? "↘" : "→"} {analysis.trend}
                    <span style={{ opacity: 0.7 }} className="text-[10px]">({analysis.trendSlopePct >= 0 ? "+" : ""}{analysis.trendSlopePct.toFixed(2)}%/gün)</span>
                  </span>
                </div>

                <p style={{ color: "var(--text-secondary)" }} className="text-[13px] leading-relaxed mt-4">
                  {analysis.valuationNote}
                </p>
              </div>

              {/* Pozisyon + uzun vade ortalamalar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">52 Haftalık Bant</p>
                  <RangeBar
                    low={analysis.yearLow}
                    high={analysis.yearHigh}
                    current={analysis.currentPrice}
                    position={analysis.rangePosition1y}
                    ticker={analysis.ticker}
                  />
                  <div className="grid grid-cols-3 gap-3 mt-4 text-[11px]">
                    <Stat label="52H Düşük" value={formatPrice(analysis.yearLow, analysis.ticker)} color="var(--up)" />
                    <Stat label="52H Ortalama" value={formatPrice(analysis.yearMean, analysis.ticker)} color="var(--text-secondary)" />
                    <Stat label="52H Yüksek" value={formatPrice(analysis.yearHigh, analysis.ticker)} color="var(--down)" />
                  </div>
                </div>

                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">5 Yıllık Bant</p>
                  <RangeBar
                    low={analysis.fiveYearLow}
                    high={analysis.fiveYearHigh}
                    current={analysis.currentPrice}
                    position={analysis.rangePosition5y}
                    ticker={analysis.ticker}
                  />
                  <div className="grid grid-cols-3 gap-3 mt-4 text-[11px]">
                    <Stat label="5Y Düşük" value={formatPrice(analysis.fiveYearLow, analysis.ticker)} color="var(--up)" />
                    <Stat label="5Y Ortalama" value={formatPrice(analysis.fiveYearMean, analysis.ticker)} color="var(--text-secondary)" />
                    <Stat label="5Y Yüksek" value={formatPrice(analysis.fiveYearHigh, analysis.ticker)} color="var(--down)" />
                  </div>
                </div>
              </div>

              {/* History chart */}
              {analysis.history.length > 1 && (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">5 Yıllık Fiyat Geçmişi (Haftalık)</p>
                  <LineChart
                    data={analysis.history.map((h) => ({
                      label: new Date(h.time * 1000).toLocaleDateString("tr-TR", { year: "numeric", month: "short" }),
                      value: h.value,
                    }))}
                    color="var(--chart-blue)"
                    height={220}
                    formatY={(v) => formatPrice(v, analysis.ticker)}
                  />
                </div>
              )}

              {/* Performans + MA pozisyonu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">Dönem Getirileri</p>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(analysis.performance).map(([label, val]) => {
                      const isUp = (val ?? 0) >= 0;
                      return (
                        <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-lg p-2.5 text-center">
                          <p style={{ color: "var(--text-muted)" }} className="text-[10px] mb-1">{label}</p>
                          <p className={`text-[13px] font-semibold tabular-nums ${val == null ? "" : isUp ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                            {val == null ? "—" : `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">Hareketli Ortalama Pozisyonu</p>
                  {analysis.movingAverages.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Yeterli veri yok.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {analysis.movingAverages.map((ma) => (
                        <div key={ma.label} className="flex items-center justify-between">
                          <span style={{ color: "var(--text-secondary)" }} className="text-[12px] font-medium">{ma.label}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums">
                              {formatPrice(ma.value, analysis.ticker)}
                            </span>
                            <span
                              style={{
                                background: ma.above ? "var(--up-bg)" : "var(--down-bg)",
                                color: ma.above ? "var(--up)" : "var(--down)",
                              }}
                              className="px-2 py-0.5 rounded text-[10.5px] font-semibold tabular-nums"
                            >
                              {ma.above ? "↑" : "↓"} {ma.deviation >= 0 ? "+" : ""}{ma.deviation.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3 leading-relaxed">
                    Fiyatın uzun vadeli ortalamalardan ne kadar uzakta olduğunu gösterir.
                    50/100/200 günlük ortalamaların üstü genelde pozitif trend, altı negatif trendin işaretidir.
                  </p>
                </div>
              </div>

              {/* Destek + Direnç */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ background: "var(--up)", width: 8, height: 8, borderRadius: "50%" }} />
                    <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Destek Seviyeleri</p>
                  </div>
                  {analysis.support.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Belirgin destek noktası yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {analysis.support.map((p, i) => {
                        const dist = ((p / analysis.currentPrice) - 1) * 100;
                        return (
                          <div key={i} style={{ borderBottom: i < analysis.support.length - 1 ? "1px solid var(--border)" : "none" }} className="flex items-center justify-between py-1.5">
                            <div>
                              <p style={{ color: "var(--text-secondary)" }} className="text-[12px]">Destek {i + 1}</p>
                              <p style={{ color: "var(--text-muted)" }} className="text-[10px]">{dist.toFixed(2)}% uzakta</p>
                            </div>
                            <p style={{ color: "var(--up)" }} className="text-[14px] font-semibold tabular-nums">{formatPrice(p, analysis.ticker)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ background: "var(--down)", width: 8, height: 8, borderRadius: "50%" }} />
                    <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Direnç Seviyeleri</p>
                  </div>
                  {analysis.resistance.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Belirgin direnç noktası yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {analysis.resistance.map((p, i) => {
                        const dist = ((p / analysis.currentPrice) - 1) * 100;
                        return (
                          <div key={i} style={{ borderBottom: i < analysis.resistance.length - 1 ? "1px solid var(--border)" : "none" }} className="flex items-center justify-between py-1.5">
                            <div>
                              <p style={{ color: "var(--text-secondary)" }} className="text-[12px]">Direnç {i + 1}</p>
                              <p style={{ color: "var(--text-muted)" }} className="text-[10px]">+{dist.toFixed(2)}% yukarıda</p>
                            </div>
                            <p style={{ color: "var(--down)" }} className="text-[14px] font-semibold tabular-nums">{formatPrice(p, analysis.ticker)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quant özet */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">İstatistiksel Özet</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="5Y Ortalama Sapma" value={`${analysis.deviationFromMean5y >= 0 ? "+" : ""}${analysis.deviationFromMean5y.toFixed(2)}%`} color={analysis.deviationFromMean5y > 15 ? "var(--down)" : analysis.deviationFromMean5y < -15 ? "var(--up)" : "var(--text-primary)"} />
                  <Stat label="1Y Z-Skor" value={`${analysis.zScore1y >= 0 ? "+" : ""}${analysis.zScore1y.toFixed(2)}σ`} color={Math.abs(analysis.zScore1y) > 1.5 ? "var(--down)" : "var(--text-primary)"} />
                  <Stat label="52H Pozisyon" value={`${analysis.rangePosition1y.toFixed(0)}%`} color="var(--text-primary)" />
                  <Stat label="5Y Pozisyon" value={`${analysis.rangePosition5y.toFixed(0)}%`} color="var(--text-primary)" />
                </div>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3 leading-relaxed">
                  <strong>Z-Skor:</strong> ±1.5σ üstü tarihsel olarak nadir, ortalamaya dönüş baskısı artar.
                  <strong> Pozisyon:</strong> 0% bant alt sınırı, 100% bant üst sınırını gösterir.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide font-medium">{label}</p>
      <p style={{ color: color || "var(--text-primary)" }} className="text-[14px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RangeBar({ low, high, current, position, ticker }: { low: number; high: number; current: number; position: number; ticker: string }) {
  return (
    <div className="relative">
      {/* track */}
      <div style={{ background: "var(--bg-tertiary)", height: 8 }} className="rounded-full overflow-hidden relative">
        <div
          style={{
            background: "linear-gradient(90deg, var(--up), #eab308, var(--down))",
            height: "100%",
            opacity: 0.5,
          }}
        />
      </div>
      {/* current marker */}
      <div
        style={{
          position: "absolute",
          left: `${Math.min(Math.max(position, 0), 100)}%`,
          top: -4,
          transform: "translateX(-50%)",
        }}
      >
        <div style={{ background: "var(--text-primary)", border: "2px solid var(--bg-card)", width: 16, height: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} className="rounded-full" />
      </div>
      <div className="flex items-center justify-between mt-2">
        <p style={{ color: "var(--up)" }} className="text-[11px] font-medium tabular-nums">{formatPrice(low, ticker)}</p>
        <p style={{ color: "var(--text-primary)" }} className="text-[11px] font-bold tabular-nums">
          ↑ {formatPrice(current, ticker)} ({position.toFixed(0)}%)
        </p>
        <p style={{ color: "var(--down)" }} className="text-[11px] font-medium tabular-nums">{formatPrice(high, ticker)}</p>
      </div>
    </div>
  );
}
