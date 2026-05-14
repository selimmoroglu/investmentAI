"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type SectorItem, type StockRow, type Market, type SectorStats } from "@/lib/api";
import { formatChange, formatMarketCap, formatRatio, formatPercent } from "@/lib/formatters";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { IndicesBar } from "@/components/layout/IndicesBar";
import { Badge, Skeleton, EmptyState, SelectIllustration } from "@/components/ui";
import { trSector } from "@/lib/sectorTr";
import { Search, SlidersHorizontal, Sparkles, Sun, Moon, BarChart3, ArrowRight, Inbox, Briefcase } from "lucide-react";

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
      <header
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--shadow-glow-accent)",
              width: 26, height: 26,
            }}
            className="rounded-lg flex items-center justify-center"
          >
            <BarChart3 size={15} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }} className="text-[15px] font-semibold">InvestmentAI</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search
            size={14}
            color="var(--text-muted)"
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sektör veya hisse ara..."
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            className="w-full pl-9 pr-4 py-[6px] rounded-lg text-[13px] outline-none placeholder:text-[var(--text-muted)] transition-all"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Yatırım Üstadları */}
          <Link
            href="/legends"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
          >
            <Sparkles size={13} strokeWidth={1.8} />
            Yatırım Üstadları
          </Link>

          {/* Screener button */}
          <Link
            href="/screener"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
          >
            <SlidersHorizontal size={13} strokeWidth={1.8} />
            Screener
          </Link>

          {/* Portföy */}
          <Link
            href="/portfolio"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
          >
            <Briefcase size={13} strokeWidth={1.8} />
            Portföy
          </Link>

          {/* Market toggle */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
            {(["BIST", "US"] as Market[]).map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                style={{
                  background: market === m ? "var(--accent-muted)" : "transparent",
                  color: market === m ? "var(--accent-primary)" : "var(--text-muted)",
                  border: market === m ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent",
                }}
                className="px-3 py-1 rounded-md text-[12px] font-semibold transition-all cursor-pointer"
              >
                {m === "BIST" ? "BIST" : "ABD"}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? (
              <Sun size={14} strokeWidth={1.8} />
            ) : (
              <Moon size={14} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sector sidebar */}
        <aside style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)", width: 230, minWidth: 230 }} className="hidden md:flex flex-col overflow-hidden">
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
                  background: "var(--brand-gradient)",
                  width: 32, height: 32,
                  boxShadow: "var(--shadow-glow-accent)",
                }}
                className="rounded-lg flex items-center justify-center shrink-0"
              >
                <BarChart3 size={16} color="#fff" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold leading-tight">Endeks Analizleri</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">BIST, NASDAQ, USD, Altın, BTC...</p>
              </div>
              <ArrowRight size={14} color="var(--text-muted)" strokeWidth={1.8} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Portföy butonu */}
          <Link
            href="/portfolio"
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(5, 150, 105, 0.06))",
              borderBottom: "1px solid var(--border)",
            }}
            className="block px-4 py-3 hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  width: 32, height: 32,
                }}
                className="rounded-lg flex items-center justify-center shrink-0"
              >
                <Briefcase size={15} color="#fff" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold leading-tight">Portföy</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">Hisselerini takip et, getiri gör</p>
              </div>
              <ArrowRight size={14} color="var(--text-muted)" strokeWidth={1.8} className="group-hover:translate-x-0.5 transition-transform" />
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
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                illustration={<SelectIllustration />}
                title="Sektör Seçin"
                description="Sol taraftan bir sektöre tıklayarak hisseleri görüntüleyin, ya da üst menüden Screener veya Yatırım Üstadları sayfalarına geçin."
                size="lg"
              />
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
