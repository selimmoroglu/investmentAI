"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, RefreshCw, ArrowLeft, TrendingUp, TrendingDown,
  BarChart3, Sun, Moon, X, Check, AlertCircle, ChevronUp, ChevronDown,
  Pencil,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type PortfolioPerfItem } from "@/lib/api";
import { type PortfolioPosition, loadPortfolio, savePortfolio, addPosition, updatePosition, removePosition } from "@/lib/portfolio";
import { formatPrice } from "@/lib/formatters";

// ─── Renkler ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4",
  "#f97316", "#8b5cf6", "#84cc16", "#ec4899", "#64748b",
];

// ─── Yardımcılar ────────────────────────────────────────────────────────────

type Period = "1d" | "1w" | "1m" | "1y" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "Günlük",
  "1w": "Haftalık",
  "1m": "Aylık",
  "1y": "Yıllık",
  "all": "Tümü",
};

function fmtBig(v: number | null, currency?: string | null): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const sym = currency === "TRY" ? "₺" : currency === "USD" ? "$" : "";
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(2)}`;
}

function fmtPct(v: number | null, showSign = true): string {
  if (v == null) return "—";
  return `${showSign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function periodChangeKey(period: Period): keyof PortfolioPerfItem | null {
  return period === "all" ? null
    : period === "1d" ? "changePercent1d"
    : period === "1w" ? "changePercent1w"
    : period === "1m" ? "changePercent1m"
    : "changePercent1y";
}

// ─── Donut Chart ────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const R = 38, SW = 16, C = 2 * Math.PI * R;
  let cum = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const arc = { ...seg, pct, dasharray: pct * C, offset: CIRCUMFERENCE_QUARTER - cum * C };
    cum += pct;
    return arc;
  });
  const CIRCUMFERENCE_QUARTER = C * 0.25;

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth={SW} />
      {arcs.map((a, i) => (
        <circle
          key={i} cx="48" cy="48" r={R} fill="none"
          stroke={a.color} strokeWidth={SW}
          strokeDasharray={`${a.dasharray} ${C - a.dasharray}`}
          strokeDashoffset={a.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

// ─── Mini bar spark ─────────────────────────────────────────────────────────

function PerfBar({ value, maxAbs }: { value: number | null; maxAbs: number }) {
  if (value == null || maxAbs === 0) return <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>;
  const pct = Math.min(Math.abs(value) / maxAbs, 1) * 100;
  const isUp = value >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: isUp ? "var(--up)" : "var(--down)" }}
        />
      </div>
      <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[11.5px] font-medium tabular-nums">
        {fmtPct(value)}
      </span>
    </div>
  );
}

// ─── Add/Edit Modal ──────────────────────────────────────────────────────────

interface ModalProps {
  onClose: () => void;
  onSave: (pos: Omit<PortfolioPosition, "id">) => void;
  initial?: PortfolioPosition | null;
}

function PositionModal({ onClose, onSave, initial }: ModalProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [lots, setLots] = useState(initial?.lots?.toString() ?? "");
  const [buyPrice, setBuyPrice] = useState(initial?.buyPrice?.toString() ?? "");
  const [buyDate, setBuyDate] = useState(initial?.buyDate ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lookupName, setLookupName] = useState(initial?.name ?? "");
  const [lookupCurrency, setLookupCurrency] = useState(initial?.currency ?? "");
  const [lookupMarket, setLookupMarket] = useState<"BIST" | "US">(initial?.market ?? "BIST");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupPrice, setLookupPrice] = useState<number | null>(initial?.buyPrice ?? null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  const handleLookup = useCallback(async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLooking(true);
    setLookupError("");
    try {
      const q = await api.portfolioQuote(t);
      setLookupName(q.name);
      setLookupCurrency(q.currency);
      setLookupMarket(q.market);
      setLookupPrice(q.currentPrice);
      if (!buyPrice && q.currentPrice) setBuyPrice(q.currentPrice.toFixed(4));
    } catch {
      setLookupError(`"${t}" bulunamadı — ticker doğru mu? (örn: THYAO.IS, AAPL)`);
      setLookupName("");
    } finally {
      setLooking(false);
    }
  }, [ticker, buyPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !lots || !buyPrice || !buyDate) return;
    if (!lookupName && !isEdit) {
      setLookupError("Önce hisseyi doğrulayın.");
      return;
    }
    setSaving(true);
    const t = ticker.trim().toUpperCase();
    onSave({
      ticker: t,
      name: lookupName || initial?.name || t,
      market: lookupMarket,
      lots: parseFloat(lots),
      buyPrice: parseFloat(buyPrice),
      buyDate,
      currency: lookupCurrency || initial?.currency || (t.endsWith(".IS") ? "TRY" : "USD"),
      notes,
    });
    setSaving(false);
  };

  const inputStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)", width: "100%", maxWidth: 440 }}
        className="rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-5 py-4 flex items-center justify-between">
          <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-semibold">
            {isEdit ? "Pozisyon Düzenle" : "Yeni Pozisyon Ekle"}
          </p>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none" }} className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Ticker */}
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">
              Ticker Sembolü
            </label>
            <div className="flex gap-2">
              <input
                style={inputStyle}
                placeholder="THYAO.IS veya AAPL"
                value={ticker}
                onChange={(e) => { setTicker(e.target.value.toUpperCase()); setLookupName(""); setLookupError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookup())}
                disabled={isEdit}
                required
              />
              {!isEdit && (
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={!ticker.trim() || looking}
                  style={{
                    background: "var(--accent-primary)", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600,
                    cursor: !ticker.trim() || looking ? "not-allowed" : "pointer",
                    opacity: !ticker.trim() ? 0.5 : 1, whiteSpace: "nowrap",
                  }}
                >
                  {looking ? "..." : "Doğrula"}
                </button>
              )}
            </div>
            {lookupName && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Check size={12} color="var(--up)" strokeWidth={2.5} />
                <span style={{ color: "var(--up)" }} className="text-[11px] font-medium">
                  {lookupName} · {lookupMarket} · {lookupCurrency}
                  {lookupPrice != null && ` · Güncel: ${lookupCurrency === "TRY" ? "₺" : "$"}${lookupPrice.toFixed(2)}`}
                </span>
              </div>
            )}
            {lookupError && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle size={12} color="var(--down)" strokeWidth={2.5} />
                <span style={{ color: "var(--down)" }} className="text-[11px]">{lookupError}</span>
              </div>
            )}
          </div>

          {/* Lots + Buy Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">
                Lot (Hisse Adedi)
              </label>
              <input
                style={inputStyle}
                type="number"
                min="0.001"
                step="1"
                placeholder="100"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">
                Alış Fiyatı
              </label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.0001"
                placeholder="285.40"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Buy Date */}
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">
              Alış Tarihi
            </label>
            <input
              style={inputStyle}
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">
              Not (Opsiyonel)
            </label>
            <input
              style={inputStyle}
              placeholder="Neden aldım, hedef fiyat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving || (!lookupName && !isEdit)}
              style={{
                background: "var(--accent-primary)", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                cursor: saving || (!lookupName && !isEdit) ? "not-allowed" : "pointer",
                opacity: (!lookupName && !isEdit) ? 0.5 : 1, flex: 2,
              }}
            >
              {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Portföye Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ───────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [perf, setPerf] = useState<Record<string, PortfolioPerfItem>>({});
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editPos, setEditPos] = useState<PortfolioPosition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"value" | "pnl" | "pnlPct" | "period">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const loadPerf = useCallback(async (pos: PortfolioPosition[]) => {
    if (pos.length === 0) { setPerf({}); return; }
    const tickers = [...new Set(pos.map((p) => p.ticker))];
    setLoadingPerf(true);
    try {
      const data = await api.portfolioPerf(tickers);
      setPerf(data);
    } catch {
      /* keep stale */
    } finally {
      setLoadingPerf(false);
    }
  }, []);

  useEffect(() => {
    const pos = loadPortfolio();
    setPositions(pos);
    loadPerf(pos);
  }, [loadPerf]);

  // ─── Enriched positions ──────────────────────────────────────────────────

  const enriched = useMemo(() => {
    return positions.map((pos) => {
      const p = perf[pos.ticker];
      const currentPrice = p?.currentPrice ?? pos.buyPrice;
      const currentValue = pos.lots * currentPrice;
      const investedValue = pos.lots * pos.buyPrice;
      const pnl = currentValue - investedValue;
      const pnlPct = investedValue !== 0 ? (pnl / investedValue) * 100 : null;

      // Dönemsel getiri
      const periodKey = periodChangeKey(period);
      const periodPct: number | null =
        period === "all"
          ? pnlPct
          : periodKey && p
          ? (p[periodKey] as number | null)
          : null;
      const periodPnl: number | null =
        period === "all"
          ? pnl
          : periodKey && p && (p[periodKey] as number | null) != null
          ? currentValue * ((p[periodKey] as number) / 100)
          : null;

      return {
        ...pos,
        currentPrice,
        currentValue,
        investedValue,
        pnl,
        pnlPct,
        periodPct,
        periodPnl,
        hasPerf: !!p,
      };
    });
  }, [positions, perf, period]);

  // Sıralama
  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let diff = 0;
      if (sortKey === "value") diff = a.currentValue - b.currentValue;
      else if (sortKey === "pnl") diff = a.pnl - b.pnl;
      else if (sortKey === "pnlPct") diff = (a.pnlPct ?? -Infinity) - (b.pnlPct ?? -Infinity);
      else if (sortKey === "period") diff = (a.periodPct ?? -Infinity) - (b.periodPct ?? -Infinity);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [enriched, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ─── Summary calculations ────────────────────────────────────────────────

  const tryPositions = enriched.filter((p) => p.currency === "TRY");
  const usdPositions = enriched.filter((p) => p.currency === "USD");

  const summaryFor = (grp: typeof enriched) => {
    const invested = grp.reduce((s, p) => s + p.investedValue, 0);
    const current = grp.reduce((s, p) => s + p.currentValue, 0);
    const pnl = current - invested;
    const pnlPct = invested !== 0 ? (pnl / invested) * 100 : null;

    // Dönem K/Z hesabı (weighted avg)
    let periodPnl = 0;
    let periodBase = 0;
    grp.forEach((p) => {
      const key = periodChangeKey(period);
      const pData = perf[p.ticker];
      if (period === "all") {
        periodPnl += p.pnl;
        periodBase += p.investedValue;
      } else if (key && pData && (pData[key] as number | null) != null) {
        const prev = p.currentValue / (1 + (pData[key] as number) / 100);
        periodPnl += p.currentValue - prev;
        periodBase += prev;
      }
    });
    const periodPct = periodBase !== 0 ? (periodPnl / periodBase) * 100 : null;

    return { invested, current, pnl, pnlPct, periodPnl, periodPct };
  };

  const trySummary = summaryFor(tryPositions);
  const usdSummary = summaryFor(usdPositions);

  // Dağılım (ağırlık) data
  const allocationData = useMemo(() => {
    const total = enriched.reduce((s, p) => s + p.currentValue, 0);
    if (total === 0) return [];
    return sorted
      .map((p, i) => ({
        label: p.ticker.replace(".IS", ""),
        value: p.currentValue,
        pct: (p.currentValue / total) * 100,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .slice(0, 10);
  }, [enriched, sorted]);

  // maxAbs for period bar charts
  const maxAbsPeriod = useMemo(() => {
    return Math.max(...enriched.map((p) => Math.abs(p.periodPct ?? 0)), 0.001);
  }, [enriched]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleAdd = useCallback((pos: Omit<PortfolioPosition, "id">) => {
    const newPos = addPosition(pos);
    const updated = [...positions, newPos];
    setPositions(updated);
    setShowAdd(false);
    loadPerf(updated);
  }, [positions, loadPerf]);

  const handleEdit = useCallback((pos: Omit<PortfolioPosition, "id">) => {
    if (!editPos) return;
    updatePosition(editPos.id, pos);
    const updated = loadPortfolio();
    setPositions(updated);
    setEditPos(null);
    loadPerf(updated);
  }, [editPos, loadPerf]);

  const handleDelete = useCallback((id: string) => {
    removePosition(id);
    const updated = loadPortfolio();
    setPositions(updated);
    setConfirmDelete(null);
    loadPerf(updated);
  }, [loadPerf]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const isEmpty = positions.length === 0;

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">
      {/* Header */}
      <header
        style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(20px)" }}
        className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4"
      >
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div style={{ background: "var(--brand-gradient)", width: 26, height: 26 }} className="rounded-lg flex items-center justify-center">
            <BarChart3 size={15} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold">InvestmentAI</span>
        </Link>

        <Link
          href="/"
          style={{ color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] transition-all"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          Ana Sayfa
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {positions.length > 0 && (
            <button
              onClick={() => loadPerf(positions)}
              disabled={loadingPerf}
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer hover:text-[var(--text-primary)] transition-all"
            >
              <RefreshCw size={13} strokeWidth={1.8} className={loadingPerf ? "animate-spin" : ""} />
              Güncelle
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: "var(--accent-primary)", color: "#fff", border: "none" }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer hover:opacity-90 transition-all"
          >
            <Plus size={14} strokeWidth={2.5} />
            Pozisyon Ekle
          </button>
          <button
            onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:text-[var(--text-primary)] transition-all"
          >
            {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-5 py-6 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ color: "var(--text-primary)" }} className="text-[22px] font-bold tracking-tight">Portföy Analizi</h1>
            <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-0.5">
              {positions.length > 0 ? `${positions.length} pozisyon · Veriler 5 dk önbelleğe alınmıştır` : "Portföyünüzü oluşturun"}
            </p>
          </div>
          {/* Period selector */}
          {positions.length > 0 && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-xl p-[3px] gap-[2px]">
              {(["all", "1d", "1w", "1m", "1y"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    background: period === p ? "var(--accent-muted)" : "transparent",
                    color: period === p ? "var(--accent-primary)" : "var(--text-muted)",
                    border: period === p ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent",
                    borderRadius: 8, padding: "4px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", maxWidth: 480, margin: "60px auto 0" }}
            className="rounded-2xl p-10 text-center"
          >
            <div style={{ width: 56, height: 56, background: "var(--accent-muted)" }} className="rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={26} color="var(--accent-primary)" strokeWidth={1.8} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-[16px] font-semibold mb-2">Portföyünüz Boş</h2>
            <p style={{ color: "var(--text-muted)" }} className="text-[13px] leading-relaxed mb-5">
              BIST veya ABD borsasından hisse ekleyerek getiri takibine başlayın.
              Veriler tarayıcınızda saklanır.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              style={{ background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={14} strokeWidth={2.5} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              İlk Pozisyonu Ekle
            </button>
          </div>
        )}

        {/* Summary Cards */}
        {!isEmpty && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ...(tryPositions.length > 0 ? [{
                  label: "TL Değer",
                  value: fmtBig(trySummary.current, "TRY"),
                  sub: `${fmtBig(trySummary.invested, "TRY")} yatırıldı`,
                  pct: trySummary.pnlPct,
                  pnl: fmtBig(trySummary.pnl, "TRY"),
                  accent: true,
                }] : []),
                ...(usdPositions.length > 0 ? [{
                  label: "USD Değer",
                  value: fmtBig(usdSummary.current, "USD"),
                  sub: `${fmtBig(usdSummary.invested, "USD")} yatırıldı`,
                  pct: usdSummary.pnlPct,
                  pnl: fmtBig(usdSummary.pnl, "USD"),
                  accent: true,
                }] : []),
                ...(tryPositions.length > 0 ? [{
                  label: `${PERIOD_LABELS[period]} K/Z (TL)`,
                  value: fmtBig(trySummary.periodPnl, "TRY"),
                  sub: null,
                  pct: trySummary.periodPct,
                  pnl: null,
                  accent: false,
                }] : []),
                ...(usdPositions.length > 0 ? [{
                  label: `${PERIOD_LABELS[period]} K/Z (USD)`,
                  value: fmtBig(usdSummary.periodPnl, "USD"),
                  sub: null,
                  pct: usdSummary.periodPct,
                  pnl: null,
                  accent: false,
                }] : []),
              ].map((card, i) => {
                const isUp = card.pct == null || card.pct >= 0;
                return (
                  <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-2">{card.label}</p>
                    <p style={{ color: "var(--text-primary)" }} className="text-[22px] font-bold tabular-nums leading-tight">{card.value}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {card.pct != null && (
                        <span
                          style={{
                            background: isUp ? "var(--up-bg)" : "var(--down-bg)",
                            color: isUp ? "var(--up)" : "var(--down)",
                            borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: "1px 7px",
                          }}
                        >
                          {fmtPct(card.pct)}
                        </span>
                      )}
                      {card.pnl != null && (
                        <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[11px] font-medium tabular-nums">
                          {card.pnl}
                        </span>
                      )}
                      {card.sub && (
                        <span style={{ color: "var(--text-muted)" }} className="text-[11px]">{card.sub}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Holdings Table */}
            <div>
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
                <div style={{ borderBottom: "1px solid var(--border)" }} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                  <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">
                    Pozisyonlar
                    {loadingPerf && <span style={{ color: "var(--text-muted)" }} className="text-[11px] font-normal ml-2">güncelleniyor...</span>}
                  </p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px]">
                    Sütun başlığına tıklayarak sırala
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: 780 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                        {[
                          { label: "Hisse", key: null, cls: "text-left px-5 py-2.5" },
                          { label: "Lot", key: null, cls: "text-right px-3 py-2.5" },
                          { label: "Alış", key: null, cls: "text-right px-3 py-2.5" },
                          { label: "Şuanki", key: null, cls: "text-right px-3 py-2.5" },
                          { label: "Piyasa Değeri", key: "value" as const, cls: "text-right px-3 py-2.5" },
                          { label: "K/Z", key: "pnl" as const, cls: "text-right px-3 py-2.5" },
                          { label: "K/Z %", key: "pnlPct" as const, cls: "text-right px-3 py-2.5" },
                          { label: PERIOD_LABELS[period], key: "period" as const, cls: "text-right px-3 py-2.5" },
                          { label: "", key: null, cls: "text-right px-3 py-2.5 w-16" },
                        ].map((col, i) => (
                          <th
                            key={i}
                            className={col.cls}
                            style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", cursor: col.key ? "pointer" : "default", userSelect: "none" }}
                            onClick={() => col.key && toggleSort(col.key)}
                          >
                            <span className="flex items-center gap-0.5 justify-end" style={{ justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
                              {col.label}
                              {col.key && sortKey === col.key && (
                                sortDir === "desc"
                                  ? <ChevronDown size={11} strokeWidth={2.5} color="var(--accent-primary)" />
                                  : <ChevronUp size={11} strokeWidth={2.5} color="var(--accent-primary)" />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((pos, i) => {
                        const isUp = pos.pnl >= 0;
                        const periodUp = pos.periodPct == null || pos.periodPct >= 0;
                        return (
                          <tr
                            key={pos.id}
                            style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                            className="hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            {/* Hisse */}
                            <td className="px-5 py-3">
                              <div
                                className="cursor-pointer"
                                onClick={() => router.push(`/stock/${pos.ticker}`)}
                              >
                                <p style={{ color: "var(--accent-primary)" }} className="text-[13px] font-bold leading-tight hover:underline">
                                  {pos.ticker.replace(".IS", "")}
                                </p>
                                <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate max-w-[160px]">{pos.name}</p>
                                {pos.notes && (
                                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] truncate max-w-[160px] mt-0.5 italic">{pos.notes}</p>
                                )}
                              </div>
                            </td>
                            {/* Lot */}
                            <td className="text-right px-3 py-3">
                              <span style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums">
                                {pos.lots % 1 === 0 ? pos.lots.toLocaleString("tr") : pos.lots.toFixed(3)}
                              </span>
                            </td>
                            {/* Alış */}
                            <td className="text-right px-3 py-3">
                              <span style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums">
                                {formatPrice(pos.buyPrice, pos.currency)}
                              </span>
                              <p style={{ color: "var(--text-muted)" }} className="text-[10px]">{pos.buyDate}</p>
                            </td>
                            {/* Şuanki */}
                            <td className="text-right px-3 py-3">
                              <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums">
                                {pos.hasPerf ? formatPrice(pos.currentPrice, pos.currency) : "—"}
                              </span>
                            </td>
                            {/* Piyasa Değeri */}
                            <td className="text-right px-3 py-3">
                              <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold tabular-nums">
                                {fmtBig(pos.currentValue, pos.currency)}
                              </span>
                            </td>
                            {/* K/Z */}
                            <td className="text-right px-3 py-3">
                              <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[12px] font-medium tabular-nums">
                                {fmtBig(pos.pnl, pos.currency)}
                              </span>
                            </td>
                            {/* K/Z % */}
                            <td className="text-right px-3 py-3">
                              <span
                                style={{
                                  background: isUp ? "var(--up-bg)" : "var(--down-bg)",
                                  color: isUp ? "var(--up)" : "var(--down)",
                                  borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: "2px 7px",
                                }}
                              >
                                {fmtPct(pos.pnlPct)}
                              </span>
                            </td>
                            {/* Dönem */}
                            <td className="text-right px-3 py-3">
                              <PerfBar value={pos.periodPct} maxAbs={maxAbsPeriod} />
                            </td>
                            {/* Aksiyon */}
                            <td className="text-right px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditPos(pos)}
                                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                                  className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                  title="Düzenle"
                                >
                                  <Pencil size={13} strokeWidth={1.8} />
                                </button>
                                {confirmDelete === pos.id ? (
                                  <button
                                    onClick={() => handleDelete(pos.id)}
                                    style={{ background: "var(--down-bg)", border: "none", color: "var(--down)", cursor: "pointer", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}
                                    onBlur={() => setConfirmDelete(null)}
                                    autoFocus
                                  >
                                    Sil?
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(pos.id)}
                                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                                    className="p-1.5 rounded-md hover:bg-[var(--down-bg)] hover:text-[var(--down)] transition-all"
                                    title="Sil"
                                  >
                                    <Trash2 size={13} strokeWidth={1.8} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            {enriched.length >= 2 && allocationData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dağılım */}
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-4">
                    Portföy Dağılımı (Piyasa Değeri)
                  </p>
                  <div className="flex items-center gap-5">
                    <DonutChart segments={allocationData} />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {allocationData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ color: "var(--text-secondary)" }} className="text-[11.5px] truncate flex-1">{d.label}</span>
                          <span style={{ color: "var(--text-primary)" }} className="text-[11.5px] font-medium tabular-nums">{d.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Getiri Karşılaştırması */}
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-4">
                    {PERIOD_LABELS[period]} Getiri Karşılaştırması
                  </p>
                  <div className="space-y-2">
                    {sorted.map((pos) => (
                      <div key={pos.id} className="flex items-center gap-3">
                        <span style={{ color: "var(--text-secondary)", width: 60 }} className="text-[11px] font-medium shrink-0 truncate">
                          {pos.ticker.replace(".IS", "")}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                          {pos.periodPct != null && maxAbsPeriod > 0 && (
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(Math.abs(pos.periodPct) / maxAbsPeriod, 1) * 100}%`,
                                background: pos.periodPct >= 0 ? "var(--up)" : "var(--down)",
                                marginLeft: pos.periodPct < 0 ? "auto" : undefined,
                              }}
                            />
                          )}
                        </div>
                        <span
                          style={{ color: pos.periodPct == null ? "var(--text-muted)" : pos.periodPct >= 0 ? "var(--up)" : "var(--down)", width: 56 }}
                          className="text-[11px] font-semibold tabular-nums text-right"
                        >
                          {fmtPct(pos.periodPct)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAdd && <PositionModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {editPos && <PositionModal onClose={() => setEditPos(null)} onSave={handleEdit} initial={editPos} />}
    </div>
  );
}
