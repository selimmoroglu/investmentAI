"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type SectorItem, type StockRow, type Market, type SectorStats } from "@/lib/api";
import { formatChange, formatMarketCap, formatRatio, formatPercent } from "@/lib/formatters";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { IndicesBar } from "@/components/layout/IndicesBar";
import { Badge, Skeleton } from "@/components/ui";
import { trSector } from "@/lib/sectorTr";

export default function Home() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [market, setMarket] = useState<Market>("BIST");
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [stats, setStats] = useState<SectorStats | null>(null);
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);

  // Load sectors on market change
  useEffect(() => {
    setLoading(true);
    setSelectedSector(null);
    setStocks([]);
    setStats(null);
    api.sectors(market)
      .then(setSectors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [market]);

  // Load stocks + stats for selected sector
  useEffect(() => {
    if (!selectedSector) { setStocks([]); setStats(null); return; }
    setStocksLoading(true);
    setStats(null);
    api.sectorStocks(selectedSector.sector, market)
      .then((d) => setStocks(d.stocks))
      .catch(console.error)
      .finally(() => setStocksLoading(false));

    api.sectorStats(selectedSector.sector, market)
      .then(setStats)
      .catch(console.error);
  }, [selectedSector, market]);

  const filteredSectors = useMemo(() => {
    if (!search.trim()) return sectors;
    const q = search.toLowerCase();
    return sectors.filter(
      (s) =>
        trSector(s.sector).toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.tickers.some((t) => t.toLowerCase().includes(q))
    );
  }, [sectors, search]);

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">
      {/* Top bar */}
      <header style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }} className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <path d="M2 18L8 10L13 14L20 4" stroke="var(--up)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="20" cy="4" r="2" fill="var(--up)"/>
          </svg>
          <span style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }} className="text-[15px] font-semibold">InvestmentAI</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="7" stroke="var(--text-muted)" strokeWidth="2"/>
            <path d="M16.5 16.5L21 21" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sektör veya hisse ara..."
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            className="w-full pl-9 pr-4 py-[6px] rounded-lg text-[13px] outline-none focus:border-blue-500/50 placeholder:text-[var(--text-muted)] transition-all"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Yatırım Üstadları */}
          <Link
            href="/legends"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            Yatırım Üstadları
          </Link>

          {/* Screener button */}
          <Link
            href="/screener"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Screener
          </Link>

          {/* Market toggle */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
            {(["BIST", "US"] as Market[]).map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                style={{
                  background: market === m ? "var(--bg-tertiary)" : "transparent",
                  color: market === m ? "var(--text-primary)" : "var(--text-muted)",
                  border: market === m ? "1px solid var(--border)" : "1px solid transparent",
                }}
                className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
              >
                {m === "BIST" ? "🇹🇷 BIST" : "🇺🇸 ABD"}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:text-[var(--text-primary)] transition-colors"
          >
            {theme === "dark" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sector sidebar */}
        <aside style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)", width: 230, minWidth: 230 }} className="flex flex-col overflow-hidden">
          {/* Endeks Analizleri butonu */}
          <Link
            href="/indices-analysis"
            style={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))",
              borderBottom: "1px solid var(--border)",
            }}
            className="block px-4 py-3 hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  width: 32, height: 32,
                  boxShadow: "0 4px 10px rgba(99, 102, 241, 0.3)",
                }}
                className="rounded-lg flex items-center justify-center shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3v18h18M7 14l4-4 4 3 5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold leading-tight">Endeks Analizleri</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">BIST, NASDAQ, USD, Altın, BTC...</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-muted)" }} className="group-hover:translate-x-0.5 transition-transform">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>

          <div style={{ borderBottom: "1px solid var(--border)" }} className="px-4 py-3">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-medium">
              Sektörler — {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="px-2 space-y-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} height="36px" />
                ))}
              </div>
            ) : (
              filteredSectors.map((item) => {
                const isActive = selectedSector?.sector === item.sector;
                return (
                  <button
                    key={item.sector}
                    onClick={() => setSelectedSector(isActive ? null : item)}
                    style={{
                      background: isActive ? "var(--bg-tertiary)" : "transparent",
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      borderLeft: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium cursor-pointer hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all text-left"
                  >
                    <span className="truncate">{trSector(item.sector)}</span>
                    <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums shrink-0 ml-2">{item.count}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Indices bar */}
          <IndicesBar />

          {!selectedSector ? (
            // Welcome state
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-4 opacity-30">
                <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 16l4-5 4 3 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[15px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sektör Seçin</p>
              <p className="text-[13px]">Sol taraftan bir sektöre tıklayarak hisseleri görüntüleyin</p>
            </div>
          ) : (
            <>
              {/* Sector header */}
              <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }} className="px-5 py-3">
                <p style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold">{trSector(selectedSector.sector)}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[12px]">{selectedSector.count} hisse senedi</p>
              </div>

              {/* Sector averages — inline */}
              <div
                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
                className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2"
              >
                <SectorStat label="Ort. Değişim" value={stats?.avgChangePercent != null ? `${stats.avgChangePercent >= 0 ? "+" : ""}${stats.avgChangePercent.toFixed(2)}%` : "—"} colorize={stats?.avgChangePercent ?? null} />
                <SectorStat label="Ort. F/K" value={formatRatio(stats?.avgPE ?? null)} />
                <SectorStat label="Medyan F/K" value={formatRatio(stats?.medianPE ?? null)} />
                <SectorStat label="Ort. PD/DD" value={formatRatio(stats?.avgPB ?? null)} />
                <SectorStat label="Ort. FD/FAVÖK" value={formatRatio(stats?.avgEVEBITDA ?? null)} />
                <SectorStat label="Ort. F/S" value={formatRatio(stats?.avgPS ?? null)} />
                <SectorStat label="Ort. ROE" value={formatPercent(stats?.avgROE ?? null)} />
                <SectorStat label="Ort. Net Marj" value={formatPercent(stats?.avgNetMargin ?? null)} />
                <SectorStat label="Ort. Temettü Verimi" value={formatPercent(stats?.avgDividendYield ?? null)} />
              </div>

              {/* Table header */}
              <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
                className="grid grid-cols-[1fr_130px_110px_130px] px-5 py-2 text-[11px] font-medium uppercase tracking-wider"
              >
                <span>Şirket</span>
                <span className="text-right">Fiyat</span>
                <span className="text-right">Değişim</span>
                <span className="text-right">Piyasa Değeri</span>
              </div>

              {/* Stock rows */}
              <div className="flex-1 overflow-y-auto">
                {stocksLoading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} height="52px" />
                    ))}
                  </div>
                ) : (
                  stocks.map((stock, i) => {
                    const isUp = (stock.changePercent ?? 0) >= 0;
                    return (
                      <div
                        key={stock.ticker}
                        onClick={() => router.push(`/stock/${stock.ticker}`)}
                        style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                        className="grid grid-cols-[1fr_130px_110px_130px] px-5 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors items-center"
                      >
                        <div>
                          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">{stock.ticker.replace(".IS", "")}</p>
                          <p style={{ color: "var(--text-muted)" }} className="text-[12px] truncate mt-0.5">{stock.name}</p>
                        </div>
                        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium tabular-nums text-right">
                          {stock.currentPrice != null ? stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </p>
                        <div className="text-right">
                          <Badge tone={stock.changePercent == null ? "neutral" : isUp ? "up" : "down"} size="sm">
                            {formatChange(stock.changePercent ?? null)}
                          </Badge>
                        </div>
                        <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">
                          {formatMarketCap(stock.marketCap ?? null, stock.currency ?? null)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>

        {/* Right watchlist panel */}
        <WatchlistPanel />
      </div>
    </div>
  );
}

function SectorStat({ label, value, colorize }: { label: string; value: string; colorize?: number | null }) {
  const color = colorize == null
    ? "var(--text-primary)"
    : colorize >= 0 ? "var(--up)" : "var(--down)";
  return (
    <div className="flex flex-col gap-0.5 min-w-[90px]">
      <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">{label}</span>
      <span style={{ color }} className="text-[12px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
