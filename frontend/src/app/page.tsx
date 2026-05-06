"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { api, type SectorItem, type Market } from "@/lib/api";

const SECTOR_ICONS: Record<string, string> = {
  "Bankacılık": "🏦",
  "Enerji": "⚡",
  "Teknoloji": "💻",
  "Technology": "💻",
  "Ulaştırma": "✈️",
  "Perakende": "🛒",
  "Consumer Discretionary": "🛍️",
  "Consumer Staples": "🧴",
  "Holding": "🏛️",
  "Financials": "💰",
  "İletişim": "📡",
  "Communication Services": "📡",
  "Savunma & Teknoloji": "🛡️",
  "Otomotiv": "🚗",
  "Tekstil": "👕",
  "Gıda": "🌾",
  "Healthcare": "💊",
  "Energy": "⚡",
  "Industrials": "🏭",
  "Gayrimenkul": "🏢",
  "Real Estate": "🏢",
  "Temel Malzemeler": "⚙️",
  "İnşaat": "🏗️",
  "Madencilik": "⛏️",
  "Utilities": "💡",
  "ETF": "📊",
};

function SectorCard({ item, market, onClick }: { item: SectorItem; market: Market; onClick: () => void }) {
  const icon = SECTOR_ICONS[item.sector] || "📈";
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
      className="group flex items-center gap-4 px-5 py-4 rounded-xl text-left w-full transition-all hover:border-[var(--text-muted)] hover:shadow-sm cursor-pointer"
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-medium truncate">
          {item.sector}
        </p>
        <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-0.5">
          {item.count} hisse
        </p>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: "var(--text-muted)" }}
        className="shrink-0 -translate-x-1 group-hover:translate-x-0 transition-transform"
      >
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [market, setMarket] = useState<Market>("BIST");
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    api.sectors(market)
      .then(setSectors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [market]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sectors;
    const q = search.toLowerCase();
    return sectors.filter((s) => s.sector.toLowerCase().includes(q));
  }, [sectors, search]);

  return (
    <div
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      className="min-h-screen flex flex-col"
    >
      <Header
        market={market}
        onMarketChange={(m) => { setMarket(m); setSearch(""); }}
        search={search}
        onSearchChange={setSearch}
      />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 style={{ color: "var(--text-primary)" }} className="text-[22px] font-semibold tracking-tight">
            Sektörler
          </h1>
          <p style={{ color: "var(--text-muted)" }} className="text-[13px] mt-1">
            {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"} — sektöre tıklayarak hisselerine ulaşın
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                className="h-[72px] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <SectorCard
                key={item.sector}
                item={item}
                market={market}
                onClick={() => router.push(`/sector/${market}/${encodeURIComponent(item.sector)}`)}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            <p className="text-2xl mb-2">🔍</p>
            <p>"{search}" için sektör bulunamadı</p>
          </div>
        )}
      </main>
    </div>
  );
}
