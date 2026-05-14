"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Quote } from "@/lib/api";
import { useWatchlist } from "@/lib/watchlist";
import { Badge, Skeleton, EmptyState, EmptyWatchlistIllustration, useToast } from "@/components/ui";
import { X, Star, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";

interface Row {
  ticker: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  change: number | null;
  currency: string | null;
  volume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

function fmtPrice(v: number | null, cur: string | null): string {
  if (v == null) return "—";
  const sym = cur === "TRY" ? "₺" : cur === "USD" ? "$" : "";
  const dec = v >= 1000 ? 0 : v >= 10 ? 2 : 4;
  return `${sym}${v.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function fmtVol(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

// Yıllık bant içi pozisyon (0-100%)
function RangeBar({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (low == null || high == null || current == null || high <= low) return null;
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  const color = pct >= 70 ? "var(--up)" : pct <= 30 ? "var(--down)" : "var(--warn)";
  return (
    <div className="relative w-full" style={{ height: 3, background: "var(--bg-tertiary)", borderRadius: 2 }}>
      <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      <div style={{ position: "absolute", left: `${pct}%`, top: -2, width: 7, height: 7, borderRadius: "50%", background: color, transform: "translateX(-50%)", border: "1.5px solid var(--bg-card)" }} />
    </div>
  );
}

export function WatchlistPanel() {
  const router = useRouter();
  const { items, remove } = useWatchlist();
  const { push: toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  const handleRemove = (ticker: string) => {
    remove(ticker);
    toast({ tone: "info", title: "Takipten çıkarıldı", description: `${ticker.replace(".IS", "")} listenizden kaldırıldı.` });
  };

  useEffect(() => {
    if (items.length === 0) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);

    Promise.all(
      items.map((it) =>
        api.quote(it.ticker)
          .then((q: Quote) => ({
            ticker: it.ticker,
            name: it.name || q.name || it.ticker,
            price: q.currentPrice,
            changePercent: q.changePercent,
            change: q.change,
            currency: q.currency,
            volume: q.volume,
            marketCap: q.marketCap,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          }))
          .catch(() => ({
            ticker: it.ticker,
            name: it.name || it.ticker,
            price: null, changePercent: null, change: null,
            currency: null, volume: null, marketCap: null,
            fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
          }))
      )
    ).then((data) => { if (!cancelled) setRows(data); })
     .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [items]);

  const totalUp = rows.filter((r) => (r.changePercent ?? 0) > 0).length;
  const totalDown = rows.filter((r) => (r.changePercent ?? 0) < 0).length;

  return (
    <aside
      style={{
        background: "var(--glass-bg)",
        borderLeft: "1px solid var(--glass-border)",
        width: 288,
        minWidth: 288,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
      }}
      className="hidden lg:flex overflow-hidden"
    >
      {/* Panel Header */}
      <div style={{ borderBottom: "1px solid var(--glass-border)", padding: "12px 16px" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={12} color="#fff" strokeWidth={2} fill="#fff" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>Takip Listem</p>
          </div>
          {items.length > 0 && (
            <span style={{ background: "var(--accent-muted)", color: "var(--accent-primary)", borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px", border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)" }}>
              {items.length}
            </span>
          )}
        </div>
        {/* Mini istatistik */}
        {rows.length > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--up)" }} />
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{totalUp} yükselen</span>
            </div>
            <div className="flex items-center gap-1">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--down)" }} />
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{totalDown} düşen</span>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {items.length === 0 ? (
          <EmptyState
            illustration={<EmptyWatchlistIllustration />}
            title="Liste boş"
            description="Hisse detay sayfasındaki yıldıza tıklayarak takip etmek istediğiniz hisseleri ekleyin."
            size="md"
          />
        ) : loading && rows.length === 0 ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="68px" />)}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {rows.map((r) => {
              const isUp = (r.changePercent ?? 0) >= 0;
              const isHovered = hoveredTicker === r.ticker;
              const changeColor = r.changePercent == null ? "var(--text-muted)" : isUp ? "var(--up)" : "var(--down)";
              const short = r.ticker.replace(".IS", "");

              return (
                <div
                  key={r.ticker}
                  onMouseEnter={() => setHoveredTicker(r.ticker)}
                  onMouseLeave={() => setHoveredTicker(null)}
                  style={{
                    borderRadius: 10,
                    background: isHovered ? "var(--bg-secondary)" : "transparent",
                    border: `1px solid ${isHovered ? "var(--border)" : "transparent"}`,
                    transition: "all 0.15s ease",
                    cursor: "pointer",
                    padding: "10px 10px 8px",
                  }}
                  className="group"
                >
                  {/* Üst satır: ticker + fiyat */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => router.push(`/stock/${r.ticker}`)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Trend ikonu */}
                        {r.changePercent != null && (
                          isUp
                            ? <TrendingUp size={10} color="var(--up)" strokeWidth={2.5} />
                            : <TrendingDown size={10} color="var(--down)" strokeWidth={2.5} />
                        )}
                        <span style={{ color: "var(--accent-primary)", fontSize: 13, fontWeight: 700, letterSpacing: "0.01em" }}>
                          {short}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }} className="truncate max-w-[90px]">
                          {r.name?.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </div>
                    </button>
                    <div className="text-right shrink-0">
                      <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }} className="tabular-nums">
                        {fmtPrice(r.price, r.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Alt satır: değişim + hacim */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <button onClick={() => router.push(`/stock/${r.ticker}`)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            background: r.changePercent != null ? (isUp ? "var(--up-bg)" : "var(--down-bg)") : "var(--bg-tertiary)",
                            color: changeColor,
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "1px 6px",
                          }}
                          className="tabular-nums"
                        >
                          {r.changePercent != null
                            ? `${isUp ? "+" : ""}${r.changePercent.toFixed(2)}%`
                            : "—"}
                        </span>
                        {r.change != null && (
                          <span style={{ color: changeColor, fontSize: 10.5 }} className="tabular-nums">
                            {isUp ? "+" : ""}{fmtPrice(r.change, r.currency)}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.volume != null && (
                        <span style={{ color: "var(--text-muted)", fontSize: 9.5 }} className="flex items-center gap-0.5">
                          <BarChart2 size={9} strokeWidth={2} />
                          {fmtVol(r.volume)}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemove(r.ticker)}
                        title="Listeden çıkar"
                        style={{
                          color: "var(--text-muted)", background: "none", border: "none",
                          cursor: "pointer", padding: "1px 3px", borderRadius: 4,
                          opacity: isHovered ? 1 : 0, transition: "all 0.15s",
                        }}
                        className="hover:text-[var(--down)] hover:bg-[var(--down-bg)]"
                        aria-label="Takipten çıkar"
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* 52 Haftalık Bant */}
                  {isHovered && r.fiftyTwoWeekLow != null && r.fiftyTwoWeekHigh != null && r.price != null && (
                    <div className="mt-2 space-y-1">
                      <RangeBar low={r.fiftyTwoWeekLow} high={r.fiftyTwoWeekHigh} current={r.price} />
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)", fontSize: 9 }} className="tabular-nums">
                          52H: {fmtPrice(r.fiftyTwoWeekLow, r.currency)}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 9 }} className="tabular-nums">
                          {fmtPrice(r.fiftyTwoWeekHigh, r.currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alt footer */}
      {rows.length > 0 && (
        <div style={{ borderTop: "1px solid var(--glass-border)", padding: "8px 16px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 9.5, textAlign: "center" }}>
            Fiyatlar 5 dk önbelleğe alınmaktadır
          </p>
        </div>
      )}
    </aside>
  );
}
