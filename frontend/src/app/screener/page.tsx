"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type StockRow, type SectorItem, type Market } from "@/lib/api";
import { formatChange, formatMarketCap, formatRatio, changeClass } from "@/lib/formatters";
import { ArrowLeft, Sun, Moon, Search } from "lucide-react";

type SortKey = "ticker" | "name" | "currentPrice" | "changePercent" | "marketCap" | "pe";
type SortDir = "asc" | "desc";

const CHANGE_FILTERS = [
  { label: "Tümü", min: -100, max: 100 },
  { label: "Yükselenler", min: 0, max: 100 },
  { label: "Düşenler", min: -100, max: 0 },
  { label: "> %2 Yükselen", min: 2, max: 100 },
  { label: "> %5 Yükselen", min: 5, max: 100 },
  { label: "< -%2 Düşen", min: -100, max: -2 },
];

type CapTier = "Tümü" | "Mega" | "Large" | "Mid" | "Small";
const CAP_TIERS: CapTier[] = ["Tümü", "Mega", "Large", "Mid", "Small"];

// Tier thresholds (raw market cap in native currency)
const CAP_THRESHOLDS: Record<Market, { mega: number; large: number; mid: number }> = {
  BIST: { mega: 100_000_000_000, large: 10_000_000_000, mid: 1_000_000_000 }, // TL
  US: { mega: 200_000_000_000, large: 10_000_000_000, mid: 2_000_000_000 }, // USD
};

function inCapTier(cap: number | null | undefined, tier: CapTier, market: Market): boolean {
  if (tier === "Tümü") return true;
  if (cap == null) return false;
  const t = CAP_THRESHOLDS[market];
  if (tier === "Mega") return cap >= t.mega;
  if (tier === "Large") return cap >= t.large && cap < t.mega;
  if (tier === "Mid") return cap >= t.mid && cap < t.large;
  if (tier === "Small") return cap < t.mid;
  return true;
}

export default function ScreenerPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [market, setMarket] = useState<Market>("BIST");
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [allStocks, setAllStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSector, setSelectedSector] = useState("Tümü");
  const [changeFilter, setChangeFilter] = useState(CHANGE_FILTERS[0]);
  const [capTier, setCapTier] = useState<CapTier>("Tümü");
  const [peMin, setPeMin] = useState("");
  const [peMax, setPeMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("changePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setAllStocks([]);
    setSelectedSector("Tümü");

    Promise.all([api.sectors(market)]).then(async ([secs]) => {
      setSectors(secs);
      // Fetch stocks for ALL sectors in parallel
      const results = await Promise.all(
        secs.map((s) => api.sectorStocks(s.sector, market).then((d) => d.stocks).catch(() => [] as StockRow[]))
      );
      setAllStocks(results.flat());
    }).catch(console.error).finally(() => setLoading(false));
  }, [market]);

  const sectorOptions = ["Tümü", ...sectors.map((s) => s.sector)];

  const filtered = useMemo(() => {
    let list = allStocks;

    if (selectedSector !== "Tümü") {
      list = list.filter((s) => s.sector === selectedSector);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }

    list = list.filter((s) => {
      if (s.changePercent == null) return true;
      return s.changePercent >= changeFilter.min && s.changePercent <= changeFilter.max;
    });

    list = list.filter((s) => inCapTier(s.marketCap, capTier, market));

    const peMinN = peMin === "" ? null : parseFloat(peMin);
    const peMaxN = peMax === "" ? null : parseFloat(peMax);
    if (peMinN != null || peMaxN != null) {
      list = list.filter((s) => {
        if (s.pe == null) return false;
        if (peMinN != null && s.pe < peMinN) return false;
        if (peMaxN != null && s.pe > peMaxN) return false;
        return true;
      });
    }

    list = [...list].sort((a, b) => {
      const rawA = a[sortKey];
      const rawB = b[sortKey];
      // Push nulls to the end regardless of sort direction
      if (rawA == null && rawB == null) return 0;
      if (rawA == null) return 1;
      if (rawB == null) return -1;
      let av: number | string = rawA;
      let bv: number | string = rawB;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [allStocks, selectedSector, search, changeFilter, capTier, peMin, peMax, market, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span style={{ color: "var(--text-primary)" }}>{sortDir === "desc" ? " ↓" : " ↑"}</span>
    ) : (
      <span style={{ color: "var(--text-muted)" }}> ↕</span>
    );

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
        <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Screener</span>

        <div className="ml-auto flex items-center gap-2">
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
            {(["BIST", "US"] as Market[]).map((m) => (
              <button key={m} onClick={() => setMarket(m)}
                style={{
                  background: market === m ? "var(--accent-muted)" : "transparent",
                  color: market === m ? "var(--accent-primary)" : "var(--text-muted)",
                  border: market === m ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent",
                }}
                className="px-3 py-1 rounded-md text-[12px] font-semibold transition-all cursor-pointer"
              >
                {m}
              </button>
            ))}
          </div>
          <button onClick={toggle} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? <Sun size={13} strokeWidth={1.8} /> : <Moon size={13} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-[20px] font-semibold tracking-tight">Hisse Senedi Tarayıcı</h1>
          <p style={{ color: "var(--text-muted)" }} className="text-[13px] mt-1">Filtrelere göre hisseleri tarayın ve sıralayın</p>
        </div>

        {/* Filters */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl p-4 flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide">Ara</label>
            <div className="relative">
              <Search size={13} color="var(--text-muted)" strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Sembol veya şirket..."
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* Sector filter */}
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide">Sektör</label>
            <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              className="px-3 py-1.5 rounded-lg text-[12px] outline-none cursor-pointer min-w-[160px]"
            >
              {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Change filter */}
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide">Değişim Filtresi</label>
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px] flex-wrap">
              {CHANGE_FILTERS.map((f) => (
                <button key={f.label} onClick={() => setChangeFilter(f)}
                  style={{ background: changeFilter.label === f.label ? "var(--bg-tertiary)" : "transparent", color: changeFilter.label === f.label ? "var(--text-primary)" : "var(--text-muted)", border: changeFilter.label === f.label ? "1px solid var(--border)" : "1px solid transparent" }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Market cap tier */}
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide">Piyasa Değeri</label>
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
              {CAP_TIERS.map((t) => (
                <button key={t} onClick={() => setCapTier(t)}
                  style={{ background: capTier === t ? "var(--bg-tertiary)" : "transparent", color: capTier === t ? "var(--text-primary)" : "var(--text-muted)", border: capTier === t ? "1px solid var(--border)" : "1px solid transparent" }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* P/E range */}
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide">F/K Aralığı</label>
            <div className="flex items-center gap-1">
              <input type="number" inputMode="decimal" value={peMin} onChange={(e) => setPeMin(e.target.value)}
                placeholder="Min"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                className="w-[68px] px-2 py-1.5 rounded-lg text-[12px] outline-none placeholder:text-[var(--text-muted)] tabular-nums"
              />
              <span style={{ color: "var(--text-muted)" }} className="text-[11px]">–</span>
              <input type="number" inputMode="decimal" value={peMax} onChange={(e) => setPeMax(e.target.value)}
                placeholder="Max"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                className="w-[68px] px-2 py-1.5 rounded-lg text-[12px] outline-none placeholder:text-[var(--text-muted)] tabular-nums"
              />
            </div>
          </div>

          {/* Result count */}
          <div className="ml-auto">
            <p style={{ color: "var(--text-muted)" }} className="text-[12px]">
              {loading ? "Yükleniyor..." : `${filtered.length} hisse senedi`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
          <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
            className="grid grid-cols-[36px_1fr_140px_100px_100px_110px_80px] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
          >
            <span>#</span>
            <button onClick={() => handleSort("name")} className="text-left cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              Şirket <SortIcon k="name" />
            </button>
            <span style={{ color: "var(--text-muted)" }}>Sektör</span>
            <button onClick={() => handleSort("currentPrice")} className="text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              Fiyat <SortIcon k="currentPrice" />
            </button>
            <button onClick={() => handleSort("changePercent")} className="text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              Değişim <SortIcon k="changePercent" />
            </button>
            <button onClick={() => handleSort("marketCap")} className="text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              Piy. Değeri <SortIcon k="marketCap" />
            </button>
            <button onClick={() => handleSort("pe")} className="text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              F/K <SortIcon k="pe" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }} className="h-[52px] animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <p>Filtrelere uygun hisse bulunamadı</p>
              </div>
            ) : (
              filtered.map((stock, idx) => {
                const isUp = (stock.changePercent ?? 0) >= 0;
                return (
                  <div
                    key={stock.ticker}
                    onClick={() => router.push(`/stock/${stock.ticker}`)}
                    style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                    className="grid grid-cols-[36px_1fr_140px_100px_100px_110px_80px] px-4 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors items-center"
                  >
                    <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums">{idx + 1}</span>
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">{stock.ticker.replace(".IS", "")}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{stock.name}</p>
                    </div>
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{stock.sector}</p>
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
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">
                      {formatRatio(stock.pe ?? null, 1)}
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
