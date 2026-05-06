"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { StockTable } from "@/components/screener/StockTable";
import { SectorsPanel } from "@/components/screener/SectorsPanel";
import { api, type StockRow, type SectorItem, type Market } from "@/lib/api";

export default function Home() {
  const [market, setMarket] = useState<Market>("BIST");
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string[] | null>(null);

  useEffect(() => {
    setLoading(true);
    setSearch("");
    setSectorFilter(null);
    Promise.all([api.stocks(market), api.sectors(market)])
      .then(([s, sec]) => {
        setStocks(s);
        setSectors(sec);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [market]);

  const filtered = useMemo(() => {
    let list = stocks;
    if (sectorFilter) {
      list = list.filter((s) => sectorFilter.includes(s.ticker));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q)
      );
    }
    return list;
  }, [stocks, search, sectorFilter]);

  return (
    <div
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      className="min-h-screen flex flex-col"
    >
      <Header
        market={market}
        onMarketChange={setMarket}
        search={search}
        onSearchChange={(s) => { setSearch(s); setSectorFilter(null); }}
      />

      <div className="flex flex-1 overflow-hidden max-w-[1600px] w-full mx-auto">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats bar */}
          <div
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}
            className="px-4 py-2 flex items-center gap-4"
          >
            <span style={{ color: "var(--text-muted)" }} className="text-[12px]">
              {loading ? "Yükleniyor..." : `${filtered.length} hisse senedi`}
            </span>
            {sectorFilter && (
              <button
                onClick={() => setSectorFilter(null)}
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                className="text-[11px] px-2 py-0.5 rounded-full hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                × Filtreyi temizle
              </button>
            )}
          </div>

          <StockTable stocks={filtered} loading={loading} />
        </div>

        {/* Sectors panel */}
        <SectorsPanel
          sectors={sectors}
          market={market}
          onSectorClick={(tickers) => {
            setSectorFilter(tickers);
            setSearch("");
          }}
        />
      </div>
    </div>
  );
}
