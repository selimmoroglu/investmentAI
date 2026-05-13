"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type SectorStocks, type SectorStats, type Market } from "@/lib/api";
import { formatMarketCap, formatChange, changeClass } from "@/lib/formatters";
import { trSector } from "@/lib/sectorTr";
import { ArrowLeft, Sun, Moon } from "lucide-react";

interface PageProps {
  params: Promise<{ market: string; name: string }>;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      className="rounded-xl px-5 py-4 flex-1 min-w-[130px]"
    >
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide mb-1">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function SectorPage({ params }: PageProps) {
  const { market, name } = use(params);
  const decodedName = decodeURIComponent(name);
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [sectorData, setSectorData] = useState<SectorStocks | null>(null);
  const [stats, setStats] = useState<SectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const marketParam = (market === "BIST" || market === "US") ? market as Market : "BIST";

  useEffect(() => {
    setLoading(true);
    api.sectorStocks(decodedName, marketParam)
      .then(setSectorData)
      .catch(console.error)
      .finally(() => setLoading(false));

    setStatsLoading(true);
    api.sectorStats(decodedName, marketParam)
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [decodedName, marketParam]);

  return (
    <div
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}
      className="flex flex-col"
    >
      {/* Header */}
      <header
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/"
            style={{ color: "var(--text-muted)" }}
            className="flex items-center gap-2 text-[13px] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            InvestmentAI
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          <span style={{ color: "var(--text-muted)" }} className="text-[13px]">Sektörler</span>
          <span style={{ color: "var(--border)" }}>/</span>
          <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">{trSector(decodedName)}</span>

          <button
            onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-[24px] font-semibold tracking-tight">
            {trSector(decodedName)} Sektörü
          </h1>
          <p style={{ color: "var(--text-muted)" }} className="text-[13px] mt-1">
            {marketParam === "BIST" ? "Borsa İstanbul" : "ABD Borsası"}
          </p>
        </div>

        {/* Sector averages */}
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[12px] uppercase tracking-wider mb-3 font-medium">
            Sektör Ortalamaları
          </p>
          {statsLoading ? (
            <div className="flex gap-3">
              {[1,2,3].map(i => (
                <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  className="flex-1 h-[76px] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <StatBox label="Ort. F/K (P/E)" value={stats?.avgPE != null ? stats.avgPE.toFixed(2) : "—"} />
              <StatBox label="Ort. PD/DD (P/B)" value={stats?.avgPB != null ? stats.avgPB.toFixed(2) : "—"} />
              <StatBox label="Ort. FD/FAVÖK (EV/EBITDA)" value={stats?.avgEVEBITDA != null ? stats.avgEVEBITDA.toFixed(2) : "—"} />
            </div>
          )}
        </div>

        {/* Stock list */}
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[12px] uppercase tracking-wider mb-3 font-medium">
            Şirketler — {sectorData?.stocks?.length ?? 0} hisse
          </p>

          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
              className="grid grid-cols-[1fr_120px_110px_110px_100px] px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider"
            >
              <span>Şirket</span>
              <span className="text-right">Fiyat</span>
              <span className="text-right">Değişim</span>
              <span className="text-right">Piyasa Değeri</span>
              <span className="text-right">F/K</span>
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                  className="h-[60px] animate-pulse" />
              ))
            ) : (
              sectorData?.stocks?.map((stock, i) => {
                const isUp = (stock.changePercent ?? 0) >= 0;
                return (
                  <div
                    key={stock.ticker}
                    onClick={() => router.push(`/stock/${stock.ticker}`)}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                    }}
                    className="grid grid-cols-[1fr_120px_110px_110px_100px] px-5 py-3.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors items-center"
                  >
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">
                        {stock.ticker.replace(".IS", "")}
                      </p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[12px] truncate mt-0.5">
                        {stock.name}
                      </p>
                    </div>
                    <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium tabular-nums text-right">
                      {stock.currentPrice != null
                        ? stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
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
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">
                      {stock.pe != null ? stock.pe.toFixed(1) : "—"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
