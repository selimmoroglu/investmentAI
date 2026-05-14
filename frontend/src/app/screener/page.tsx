"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type StockRow, type SectorItem, type Market } from "@/lib/api";
import { formatMarketCap, formatRatio } from "@/lib/formatters";
import { Skeleton } from "@/components/ui";
import {
  ArrowLeft, Sun, Moon, Search, X, SlidersHorizontal, TrendingUp,
  TrendingDown, BarChart3, Zap, Target, Layers, ChevronUp, ChevronDown,
} from "lucide-react";

// ─── Tipler & Sabitler ───────────────────────────────────────────────────────

type SortKey = "ticker" | "name" | "currentPrice" | "changePercent" | "marketCap" | "pe" | "volume";
type SortDir = "asc" | "desc";
type CapTier = "Tümü" | "Mega" | "Large" | "Mid" | "Small";

const CAP_TIERS: CapTier[] = ["Tümü", "Mega", "Large", "Mid", "Small"];
const CAP_THRESHOLDS: Record<Market, { mega: number; large: number; mid: number }> = {
  BIST: { mega: 100_000_000_000, large: 10_000_000_000, mid: 1_000_000_000 },
  US:   { mega: 200_000_000_000, large: 10_000_000_000, mid: 2_000_000_000 },
};

function inCapTier(cap: number | null | undefined, tier: CapTier, market: Market): boolean {
  if (tier === "Tümü") return true;
  if (cap == null) return false;
  const t = CAP_THRESHOLDS[market];
  if (tier === "Mega")  return cap >= t.mega;
  if (tier === "Large") return cap >= t.large && cap < t.mega;
  if (tier === "Mid")   return cap >= t.mid   && cap < t.large;
  return cap < t.mid;
}

interface Strategy {
  id: string;
  label: string;
  icon: React.ReactNode;
  desc: string;
  changeMin?: number;
  changeMax?: number;
  peMin?: string;
  peMax?: string;
  capTier?: CapTier;
  volMin?: string;
}

const STRATEGIES: Strategy[] = [
  {
    id: "all",
    label: "Tüm Hisseler",
    icon: <Layers size={13} strokeWidth={1.8} />,
    desc: "Filtre uygulanmamış",
  },
  {
    id: "gainers",
    label: "Günün Yükselenleri",
    icon: <TrendingUp size={13} strokeWidth={1.8} />,
    desc: "Pozitif değişim",
    changeMin: 0.01,
  },
  {
    id: "momentum",
    label: "Güçlü Momentum",
    icon: <Zap size={13} strokeWidth={1.8} />,
    desc: ">%3 yükselen",
    changeMin: 3,
  },
  {
    id: "losers",
    label: "Düşenler",
    icon: <TrendingDown size={13} strokeWidth={1.8} />,
    desc: "Negatif değişim",
    changeMax: -0.01,
  },
  {
    id: "value",
    label: "Değer Odaklı",
    icon: <Target size={13} strokeWidth={1.8} />,
    desc: "F/K 3–15 arası",
    peMin: "3",
    peMax: "15",
  },
  {
    id: "largecap",
    label: "Büyük Şirketler",
    icon: <BarChart3 size={13} strokeWidth={1.8} />,
    desc: "Mega + Large Cap",
    capTier: "Large",
  },
];

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function fmtVol(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

function fmtChange(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ─── Bileşenler ──────────────────────────────────────────────────────────────

function StrategyChip({ strategy, active, onClick }: { strategy: Strategy; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active
          ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
          : "var(--bg-secondary)",
        border: active ? "1px solid transparent" : "1px solid var(--border)",
        color: active ? "#fff" : "var(--text-secondary)",
        borderRadius: 10,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: active ? "var(--shadow-glow-accent)" : "none",
        whiteSpace: "nowrap",
      }}
      className="flex items-center gap-2 hover:border-[var(--border-strong)] transition-all"
    >
      <span style={{ opacity: active ? 1 : 0.7 }}>{strategy.icon}</span>
      <span>{strategy.label}</span>
      {!active && <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{strategy.desc}</span>}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      style={{ background: "var(--accent-muted)", border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)", color: "var(--accent-primary)", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}
      className="flex items-center gap-1.5 cursor-default"
    >
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", display: "flex", alignItems: "center" }}>
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function SortButton({ label, sk, sortKey, sortDir, onSort }: {
  label: string; sk: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === sk;
  return (
    <button
      onClick={() => onSort(sk)}
      style={{ color: active ? "var(--text-primary)" : "var(--text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}
      className="hover:text-[var(--text-primary)] transition-colors"
    >
      {label}
      {active ? (
        sortDir === "desc"
          ? <ChevronDown size={11} strokeWidth={2.5} color="var(--accent-primary)" />
          : <ChevronUp size={11} strokeWidth={2.5} color="var(--accent-primary)" />
      ) : (
        <ChevronDown size={11} strokeWidth={2} style={{ opacity: 0.3 }} />
      )}
    </button>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function ScreenerPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [market, setMarket] = useState<Market>("BIST");
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [allStocks, setAllStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStrategy, setActiveStrategy] = useState("all");
  const [selectedSector, setSelectedSector] = useState("Tümü");
  const [changeMin, setChangeMin] = useState("");
  const [changeMax, setChangeMax] = useState("");
  const [capTier, setCapTier] = useState<CapTier>("Tümü");
  const [peMin, setPeMin] = useState("");
  const [peMax, setPeMax] = useState("");
  const [volMin, setVolMin] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("changePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    setAllStocks([]);
    setSelectedSector("Tümü");
    setActiveStrategy("all");
    clearFilters();

    Promise.all([api.sectors(market)]).then(async ([secs]) => {
      setSectors(secs);
      const results = await Promise.all(
        secs.map((s) => api.sectorStocks(s.sector, market).then((d) => d.stocks).catch(() => [] as StockRow[]))
      );
      setAllStocks(results.flat());
    }).catch(console.error).finally(() => setLoading(false));
  }, [market]);

  const sectorOptions = ["Tümü", ...sectors.map((s) => s.sector)];

  function clearFilters() {
    setChangeMin(""); setChangeMax(""); setCapTier("Tümü");
    setPeMin(""); setPeMax(""); setVolMin(""); setSearch("");
  }

  function applyStrategy(s: Strategy) {
    clearFilters();
    setActiveStrategy(s.id);
    if (s.changeMin != null) setChangeMin(s.changeMin.toString());
    if (s.changeMax != null) setChangeMax(s.changeMax.toString());
    if (s.peMin) setPeMin(s.peMin);
    if (s.peMax) setPeMax(s.peMax);
    if (s.capTier) setCapTier(s.capTier);
    if (s.volMin) setVolMin(s.volMin);
  }

  function handleCustomFilter() {
    setActiveStrategy("custom");
  }

  // Active filter chips
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (search) activeFilters.push({ label: `Ara: "${search}"`, clear: () => setSearch("") });
  if (selectedSector !== "Tümü") activeFilters.push({ label: `Sektör: ${selectedSector}`, clear: () => setSelectedSector("Tümü") });
  if (changeMin || changeMax) activeFilters.push({ label: `Değişim: ${changeMin || "?"} – ${changeMax || "?"}%`, clear: () => { setChangeMin(""); setChangeMax(""); } });
  if (capTier !== "Tümü") activeFilters.push({ label: `Cap: ${capTier}`, clear: () => setCapTier("Tümü") });
  if (peMin || peMax) activeFilters.push({ label: `F/K: ${peMin || "?"} – ${peMax || "?"}`, clear: () => { setPeMin(""); setPeMax(""); } });
  if (volMin) activeFilters.push({ label: `Hacim ≥ ${volMin}M`, clear: () => setVolMin("") });

  const filtered = useMemo(() => {
    let list = allStocks;
    if (selectedSector !== "Tümü") list = list.filter((s) => s.sector === selectedSector);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (changeMin !== "") list = list.filter((s) => s.changePercent != null && s.changePercent >= parseFloat(changeMin));
    if (changeMax !== "") list = list.filter((s) => s.changePercent != null && s.changePercent <= parseFloat(changeMax));
    list = list.filter((s) => inCapTier(s.marketCap, capTier, market));
    if (peMin !== "" || peMax !== "") {
      const pmn = peMin !== "" ? parseFloat(peMin) : null;
      const pmx = peMax !== "" ? parseFloat(peMax) : null;
      list = list.filter((s) => {
        if (s.pe == null) return false;
        if (pmn != null && s.pe < pmn) return false;
        if (pmx != null && s.pe > pmx) return false;
        return true;
      });
    }
    if (volMin !== "") {
      const vmin = parseFloat(volMin) * 1_000_000;
      list = list.filter((s) => s.volume != null && s.volume >= vmin);
    }
    return [...list].sort((a, b) => {
      const ra = a[sortKey], rb = b[sortKey];
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      let av: number | string = ra, bv: number | string = rb;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [allStocks, selectedSector, search, changeMin, changeMax, capTier, peMin, peMax, volMin, market, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Stats
  const posCount = filtered.filter((s) => (s.changePercent ?? 0) > 0).length;
  const negCount = filtered.filter((s) => (s.changePercent ?? 0) < 0).length;

  const inp = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">

      {/* Header */}
      <header
        style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        className="sticky top-0 z-50 h-14 flex items-center px-6 gap-4"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/" style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5 text-[12px] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={13} strokeWidth={1.8} />
            InvestmentAI
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          <div className="flex items-center gap-1.5">
            <div style={{ background: "var(--brand-gradient)", width: 20, height: 20 }} className="rounded-md flex items-center justify-center">
              <SlidersHorizontal size={11} color="#fff" strokeWidth={2} />
            </div>
            <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Screener</span>
          </div>
        </div>

        {/* Market stats */}
        {!loading && allStocks.length > 0 && (
          <div className="hidden md:flex items-center gap-4 ml-4">
            <span style={{ color: "var(--text-muted)" }} className="text-[11px]">
              {allStocks.length} hisse
            </span>
            <span style={{ color: "var(--up)", fontSize: 11 }} className="flex items-center gap-1">
              <TrendingUp size={11} strokeWidth={2} />
              {allStocks.filter((s) => (s.changePercent ?? 0) > 0).length} yükseliyor
            </span>
            <span style={{ color: "var(--down)", fontSize: 11 }} className="flex items-center gap-1">
              <TrendingDown size={11} strokeWidth={2} />
              {allStocks.filter((s) => (s.changePercent ?? 0) < 0).length} düşüyor
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Market toggle */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-lg p-[3px] gap-[2px]">
            {(["BIST", "US"] as Market[]).map((m) => (
              <button key={m} onClick={() => setMarket(m)}
                style={{ background: market === m ? "var(--accent-muted)" : "transparent", color: market === m ? "var(--accent-primary)" : "var(--text-muted)", border: market === m ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent" }}
                className="px-3 py-1 rounded-md text-[12px] font-semibold transition-all cursor-pointer">
                {m === "BIST" ? "BIST" : "ABD"}
              </button>
            ))}
          </div>
          <button onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:text-[var(--text-primary)] transition-all"
            aria-label="Tema">
            {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-5 space-y-4">

        {/* Strateji Ön Ayarları */}
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-2">Strateji Ön Ayarları</p>
          <div className="flex flex-wrap gap-2">
            {STRATEGIES.map((s) => (
              <StrategyChip key={s.id} strategy={s} active={activeStrategy === s.id} onClick={() => applyStrategy(s)} />
            ))}
          </div>
        </div>

        {/* Filtre Paneli */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14 }} className="overflow-hidden">
          {/* Filtre başlığı */}
          <div
            style={{ borderBottom: showFilters ? "1px solid var(--border)" : "none", background: "var(--bg-secondary)" }}
            className="flex items-center justify-between px-5 py-3"
          >
            <div className="flex items-center gap-4 flex-1 flex-wrap">
              {/* Arama */}
              <div className="relative">
                <Search size={13} color="var(--text-muted)" strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="text" value={search}
                  onChange={(e) => { setSearch(e.target.value); handleCustomFilter(); }}
                  placeholder="Hisse ara..."
                  style={{ ...inp, paddingLeft: 30, minWidth: 160 }}
                />
              </div>

              {/* Sektör */}
              <select value={selectedSector} onChange={(e) => { setSelectedSector(e.target.value); handleCustomFilter(); }}
                style={{ ...inp, cursor: "pointer", minWidth: 140 }}>
                {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Piyasa Değeri */}
              <div className="flex items-center gap-1">
                {CAP_TIERS.map((t) => (
                  <button key={t} onClick={() => { setCapTier(t); handleCustomFilter(); }}
                    style={{
                      background: capTier === t ? "var(--accent-muted)" : "transparent",
                      color: capTier === t ? "var(--accent-primary)" : "var(--text-muted)",
                      border: capTier === t ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid var(--border)",
                      borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {/* Gelişmiş filtreler toggle */}
              <button onClick={() => setShowFilters((v) => !v)}
                style={{ background: showFilters ? "var(--accent-muted)" : "var(--bg-tertiary)", border: `1px solid ${showFilters ? "color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "var(--border)"}`, color: showFilters ? "var(--accent-primary)" : "var(--text-muted)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}
                className="flex items-center gap-1.5 transition-all">
                <SlidersHorizontal size={12} strokeWidth={1.8} />
                Gelişmiş
                {showFilters && activeFilters.length > 0 && (
                  <span style={{ background: "var(--accent-primary)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {/* Sıfırla */}
              {activeFilters.length > 0 && (
                <button onClick={() => { clearFilters(); setActiveStrategy("all"); }}
                  style={{ background: "var(--down-bg)", border: "1px solid color-mix(in srgb, var(--down) 20%, transparent)", color: "var(--down)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  className="flex items-center gap-1 transition-all">
                  <X size={11} strokeWidth={2.5} />
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Gelişmiş Filtreler (expandable) */}
          {showFilters && (
            <div style={{ borderBottom: "1px solid var(--border)" }} className="px-5 py-4 flex flex-wrap gap-5 items-end">
              {/* F/K aralığı */}
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">F/K (P/E) Aralığı</label>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" value={peMin} onChange={(e) => { setPeMin(e.target.value); handleCustomFilter(); }}
                    placeholder="Min" style={{ ...inp, width: 72 }} />
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>–</span>
                  <input type="number" inputMode="decimal" value={peMax} onChange={(e) => { setPeMax(e.target.value); handleCustomFilter(); }}
                    placeholder="Max" style={{ ...inp, width: 72 }} />
                </div>
              </div>

              {/* Değişim aralığı */}
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Değişim % Aralığı</label>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" value={changeMin} onChange={(e) => { setChangeMin(e.target.value); handleCustomFilter(); }}
                    placeholder="Min %" style={{ ...inp, width: 80 }} />
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>–</span>
                  <input type="number" inputMode="decimal" value={changeMax} onChange={(e) => { setChangeMax(e.target.value); handleCustomFilter(); }}
                    placeholder="Max %" style={{ ...inp, width: 80 }} />
                </div>
              </div>

              {/* Min Hacim */}
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Min Hacim (Milyon)</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" inputMode="decimal" value={volMin} onChange={(e) => { setVolMin(e.target.value); handleCustomFilter(); }}
                    placeholder="1" style={{ ...inp, width: 100 }} />
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>M</span>
                </div>
              </div>
            </div>
          )}

          {/* Aktif Filtre Chips */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
              <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold shrink-0">Aktif:</span>
              {activeFilters.map((f, i) => (
                <FilterChip key={i} label={f.label} onRemove={f.clear} />
              ))}
            </div>
          )}
        </div>

        {/* Sonuç Bilgisi */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">
              {loading ? "Yükleniyor..." : `${filtered.length} hisse senedi`}
            </p>
            {!loading && filtered.length > 0 && (
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--up)" }} className="text-[11px] flex items-center gap-1">
                  <TrendingUp size={11} strokeWidth={2} />
                  {posCount} yükselen
                </span>
                <span style={{ color: "var(--down)" }} className="text-[11px] flex items-center gap-1">
                  <TrendingDown size={11} strokeWidth={2} />
                  {negCount} düşen
                </span>
              </div>
            )}
          </div>
          {!loading && (
            <p style={{ color: "var(--text-muted)" }} className="text-[11px]">
              {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"} · Sıralama: {sortKey === "changePercent" ? "Değişim" : sortKey === "marketCap" ? "Piy. Değeri" : sortKey === "pe" ? "F/K" : sortKey === "volume" ? "Hacim" : sortKey === "currentPrice" ? "Fiyat" : "İsim"} {sortDir === "desc" ? "↓" : "↑"}
            </p>
          )}
        </div>

        {/* Tablo */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          {/* Header */}
          <div
            style={{ display: "grid", gridTemplateColumns: "36px 1fr 140px 110px 110px 120px 80px 90px", padding: "10px 20px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, letterSpacing: "0.07em" }}>#</span>
            <SortButton label="Şirket" sk="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Sektör</span>
            <div className="text-right"><SortButton label="Fiyat" sk="currentPrice" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
            <div className="text-right"><SortButton label="Değişim" sk="changePercent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
            <div className="text-right"><SortButton label="Piy. Değeri" sk="marketCap" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
            <div className="text-right"><SortButton label="F/K" sk="pe" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
            <div className="text-right"><SortButton label="Hacim" sk="volume" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
          </div>

          {/* Satırlar */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 380px)" }}>
            {loading ? (
              Array.from({ length: 15 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)", padding: "10px 20px", display: "grid", gridTemplateColumns: "36px 1fr 140px 110px 110px 120px 80px 90px", gap: 8, alignItems: "center" }}>
                  <Skeleton width={20} height={12} />
                  <div className="space-y-1.5"><Skeleton width="60%" height={13} /><Skeleton width="40%" height={10} /></div>
                  <Skeleton width="70%" height={11} />
                  <Skeleton width="80%" height={13} />
                  <Skeleton width={60} height={22} />
                  <Skeleton width="60%" height={12} />
                  <Skeleton width={40} height={12} />
                  <Skeleton width={50} height={12} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Search size={28} color="var(--text-muted)" strokeWidth={1.5} />
                <p style={{ color: "var(--text-muted)" }} className="text-[13px]">Filtrelere uygun hisse bulunamadı</p>
                <button onClick={() => { clearFilters(); setActiveStrategy("all"); }}
                  style={{ background: "var(--accent-muted)", border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)", color: "var(--accent-primary)", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Filtreleri Temizle
                </button>
              </div>
            ) : (
              filtered.map((stock, idx) => {
                const isUp = (stock.changePercent ?? 0) >= 0;
                const isFlat = stock.changePercent == null || Math.abs(stock.changePercent) < 0.01;
                return (
                  <div
                    key={stock.ticker}
                    onClick={() => router.push(`/stock/${stock.ticker}`)}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      background: idx % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                      display: "grid",
                      gridTemplateColumns: "36px 1fr 140px 110px 110px 120px 80px 90px",
                      padding: "10px 20px",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    className="hover:bg-[var(--bg-tertiary)]"
                  >
                    {/* Rank */}
                    <span style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums">{idx + 1}</span>

                    {/* Şirket */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-bold">{stock.ticker.replace(".IS", "")}</p>
                        {stock.changePercent != null && !isFlat && (
                          <span style={{ color: isUp ? "var(--up)" : "var(--down)", opacity: 0.6 }}>
                            {isUp ? <TrendingUp size={11} strokeWidth={2} /> : <TrendingDown size={11} strokeWidth={2} />}
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{stock.name}</p>
                    </div>

                    {/* Sektör */}
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{stock.sector}</p>

                    {/* Fiyat */}
                    <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold tabular-nums text-right">
                      {stock.currentPrice != null
                        ? (stock.currentPrice < 10
                          ? stock.currentPrice.toFixed(3)
                          : stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                        : "—"}
                    </p>

                    {/* Değişim */}
                    <div className="text-right">
                      {stock.changePercent != null ? (
                        <span
                          style={{
                            background: isFlat ? "var(--bg-tertiary)" : isUp ? "var(--up-bg)" : "var(--down-bg)",
                            color: isFlat ? "var(--text-muted)" : isUp ? "var(--up)" : "var(--down)",
                            borderRadius: 7,
                            padding: "3px 8px",
                            fontSize: 12,
                            fontWeight: 700,
                            display: "inline-block",
                          }}
                        >
                          {fmtChange(stock.changePercent)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>
                      )}
                    </div>

                    {/* Piyasa Değeri */}
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">
                      {formatMarketCap(stock.marketCap ?? null, stock.currency ?? null)}
                    </p>

                    {/* F/K */}
                    <p style={{
                      color: stock.pe == null ? "var(--text-muted)" : stock.pe < 10 ? "var(--up)" : stock.pe < 25 ? "var(--text-primary)" : "var(--warn)",
                    }} className="text-[12px] tabular-nums text-right font-medium">
                      {formatRatio(stock.pe ?? null, 1)}
                    </p>

                    {/* Hacim */}
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] tabular-nums text-right">
                      {fmtVol(stock.volume ?? null)}
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
