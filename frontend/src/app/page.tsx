"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type SectorItem, type StockRow, type Market } from "@/lib/api";
import { formatChange, formatMarketCap, changeClass } from "@/lib/formatters";

export default function Home() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [market, setMarket] = useState<Market>("BIST");
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);

  // Load sectors on market change
  useEffect(() => {
    setLoading(true);
    setSelectedSector(null);
    setStocks([]);
    api.sectors(market)
      .then(setSectors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [market]);

  // Load stocks for selected sector
  useEffect(() => {
    if (!selectedSector) { setStocks([]); return; }
    setStocksLoading(true);
    api.sectorStocks(selectedSector.sector, market)
      .then((d) => setStocks(d.stocks))
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, [selectedSector, market]);

  const filteredSectors = useMemo(() => {
    if (!search.trim()) return sectors;
    const q = search.toLowerCase();
    return sectors.filter(
      (s) =>
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
          <div style={{ borderBottom: "1px solid var(--border)" }} className="px-4 py-3">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-medium">
              Sektörler — {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ background: "var(--bg-secondary)", margin: "3px 8px" }} className="h-9 rounded-lg animate-pulse" />
              ))
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
                    <span className="truncate">{item.sector}</span>
                    <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums shrink-0 ml-2">{item.count}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden">
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
              <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold">{selectedSector.sector}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[12px]">{selectedSector.count} hisse senedi</p>
                </div>
                <Link
                  href={`/sector/${market}/${encodeURIComponent(selectedSector.sector)}`}
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  className="text-[12px] px-3 py-1.5 rounded-lg hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
                >
                  Sektör Detayı →
                </Link>
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
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                      className="h-[58px] animate-pulse" />
                  ))
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
                          <span
                            style={{ background: stock.changePercent != null ? (isUp ? "var(--up-bg)" : "var(--down-bg)") : "transparent" }}
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium tabular-nums ${changeClass(stock.changePercent ?? null)}`}
                          >
                            {formatChange(stock.changePercent ?? null)}
                          </span>
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
      </div>
    </div>
  );
}
