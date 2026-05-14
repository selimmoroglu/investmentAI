"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, RefreshCw, ArrowLeft, BarChart3, Sun, Moon, X,
  Check, AlertCircle, ChevronUp, ChevronDown, Pencil, ShieldCheck,
  TrendingUp, Layers, Award, Loader2,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, type PortfolioPerfItem, type PortfolioAnalysis, type PortfolioPositionAnalysis } from "@/lib/api";
import { type PortfolioPosition, loadPortfolio, addPosition, updatePosition, removePosition } from "@/lib/portfolio";
import { formatPrice } from "@/lib/formatters";

// ─── Sabitler ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4",
  "#f97316", "#8b5cf6", "#84cc16", "#ec4899", "#64748b",
];

type Period = "1d" | "1w" | "1m" | "1y" | "all";
type Tab = "overview" | "risk" | "longterm";

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "Günlük", "1w": "Haftalık", "1m": "Aylık", "1y": "Yıllık", "all": "Tümü",
};

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

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
  if (period === "all") return null;
  if (period === "1d") return "changePercent1d";
  if (period === "1w") return "changePercent1w";
  if (period === "1m") return "changePercent1m";
  return "changePercent1y";
}

function verdictColor(color: string) {
  if (color === "up") return "var(--up)";
  if (color === "down") return "var(--down)";
  return "var(--warn)";
}

// ─── DonutChart ──────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const R = 38, SW = 16, C = 2 * Math.PI * R;
  let cum = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const arc = { ...seg, pct, dasharray: pct * C, offset: C * 0.25 - cum * C };
    cum += pct;
    return arc;
  });
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth={SW} />
      {arcs.map((a, i) => (
        <circle key={i} cx="48" cy="48" r={R} fill="none"
          stroke={a.color} strokeWidth={SW}
          strokeDasharray={`${a.dasharray} ${C - a.dasharray}`}
          strokeDashoffset={a.offset} strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

// ─── PerfBar ─────────────────────────────────────────────────────────────────

function PerfBar({ value, maxAbs }: { value: number | null; maxAbs: number }) {
  if (value == null || maxAbs === 0) return <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>;
  const pct = Math.min(Math.abs(value) / maxAbs, 1) * 100;
  const isUp = value >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isUp ? "var(--up)" : "var(--down)" }} />
      </div>
      <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[11.5px] font-medium tabular-nums">
        {fmtPct(value)}
      </span>
    </div>
  );
}

// ─── ScoreGauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, verdict, color, size = "lg" }: {
  score: number; verdict: string; color: string; size?: "sm" | "lg";
}) {
  const c = verdictColor(color);
  const [dim, fontSize, subSize] = size === "lg" ? [96, 30, 10] : [64, 20, 9];
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: dim, height: dim, borderRadius: "50%",
          border: `3px solid ${c}`,
          background: `radial-gradient(circle, color-mix(in srgb, ${c} 8%, transparent), transparent)`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontSize, fontWeight: 800, color: c, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: subSize, color: "var(--text-muted)", marginTop: 2 }}>/100</span>
      </div>
      <span style={{ color: c, fontSize: size === "lg" ? 13 : 11, fontWeight: 700 }}>{verdict}</span>
    </div>
  );
}

// ─── ScoreBar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value, 100);
  const c = value >= 65 ? "var(--up)" : value >= 45 ? "var(--warn)" : "var(--down)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">{label}</span>
        <span style={{ color: c }} className="text-[12px] font-bold tabular-nums">{value}</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── SectorBar ───────────────────────────────────────────────────────────────

function SectorBar({ label, weight, color }: { label: string; weight: number; color: string }) {
  const pct = Math.min(weight * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span style={{ color: "var(--text-secondary)", width: 140 }} className="text-[12px] truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ color: "var(--text-primary)", width: 44 }} className="text-[12px] font-semibold tabular-nums text-right">
        {(weight * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── DiversificationMeter ────────────────────────────────────────────────────

function DiversificationMeter({ score }: { score: number }) {
  const c = score >= 65 ? "var(--up)" : score >= 40 ? "var(--warn)" : "var(--down)";
  const label = score >= 65 ? "İyi" : score >= 40 ? "Orta" : "Zayıf";
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-semibold">Çeşitlendirme</span>
        <span style={{ color: c }} className="text-[11px] font-bold">{label}</span>
      </div>
      <div style={{ height: 8, background: "var(--bg-tertiary)", borderRadius: 4 }}>
        <div style={{ width: `${score}%`, height: "100%", background: c, borderRadius: 4 }} />
      </div>
      <span style={{ color: "var(--text-muted)" }} className="text-[10px]">{score}/100</span>
    </div>
  );
}

// ─── PositionModal ───────────────────────────────────────────────────────────

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
  const isEdit = !!initial;

  const handleLookup = useCallback(async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLooking(true); setLookupError("");
    try {
      const q = await api.portfolioQuote(t);
      setLookupName(q.name); setLookupCurrency(q.currency); setLookupMarket(q.market); setLookupPrice(q.currentPrice);
      if (!buyPrice && q.currentPrice) setBuyPrice(q.currentPrice.toFixed(4));
    } catch {
      setLookupError(`"${t}" bulunamadı — örn: THYAO.IS, AAPL`);
      setLookupName("");
    } finally {
      setLooking(false);
    }
  }, [ticker, buyPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !lots || !buyPrice || !buyDate) return;
    if (!lookupName && !isEdit) { setLookupError("Önce hisseyi doğrulayın."); return; }
    const t = ticker.trim().toUpperCase();
    onSave({
      ticker: t, name: lookupName || initial?.name || t,
      market: lookupMarket, lots: parseFloat(lots),
      buyPrice: parseFloat(buyPrice), buyDate,
      currency: lookupCurrency || initial?.currency || (t.endsWith(".IS") ? "TRY" : "USD"),
      notes,
    });
  };

  const inp = { background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)", width: "100%", maxWidth: 440 }} className="rounded-2xl overflow-hidden">
        <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }} className="px-5 py-4 flex items-center justify-between">
          <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-semibold">{isEdit ? "Pozisyon Düzenle" : "Yeni Pozisyon Ekle"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none" }} className="cursor-pointer hover:text-[var(--text-primary)]"><X size={18} strokeWidth={2} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">Ticker</label>
            <div className="flex gap-2">
              <input style={inp} placeholder="THYAO.IS veya AAPL" value={ticker}
                onChange={(e) => { setTicker(e.target.value.toUpperCase()); setLookupName(""); setLookupError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookup())}
                disabled={isEdit} required />
              {!isEdit && (
                <button type="button" onClick={handleLookup} disabled={!ticker.trim() || looking}
                  style={{ background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: !ticker.trim() || looking ? "not-allowed" : "pointer", opacity: !ticker.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
                  {looking ? "..." : "Doğrula"}
                </button>
              )}
            </div>
            {lookupName && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Check size={12} color="var(--up)" strokeWidth={2.5} />
                <span style={{ color: "var(--up)" }} className="text-[11px] font-medium">
                  {lookupName} · {lookupMarket} · {lookupCurrency}
                  {lookupPrice != null && ` · ${lookupCurrency === "TRY" ? "₺" : "$"}${lookupPrice.toFixed(2)}`}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">Lot (Adet)</label>
              <input style={inp} type="number" min="0.001" step="1" placeholder="100" value={lots} onChange={(e) => setLots(e.target.value)} required />
            </div>
            <div>
              <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">Alış Fiyatı</label>
              <input style={inp} type="number" min="0" step="0.0001" placeholder="285.40" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} required />
            </div>
          </div>
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">Alış Tarihi</label>
            <input style={inp} type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <label style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium block mb-1.5">Not (Opsiyonel)</label>
            <input style={inp} placeholder="Neden aldım, hedef fiyat..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", flex: 1 }}>İptal</button>
            <button type="submit" disabled={!lookupName && !isEdit}
              style={{ background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: (!lookupName && !isEdit) ? "not-allowed" : "pointer", opacity: (!lookupName && !isEdit) ? 0.5 : 1, flex: 2 }}>
              {isEdit ? "Güncelle" : "Portföye Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  // ── Temel state ──────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [perf, setPerf] = useState<Record<string, PortfolioPerfItem>>({});
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [tab, setTab] = useState<Tab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [editPos, setEditPos] = useState<PortfolioPosition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"value" | "pnl" | "pnlPct" | "period">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Analiz state ─────────────────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // ── Veri yükleme ─────────────────────────────────────────────────────────

  const loadPerf = useCallback(async (pos: PortfolioPosition[]) => {
    if (pos.length === 0) { setPerf({}); return; }
    const tickers = [...new Set(pos.map((p) => p.ticker))];
    setLoadingPerf(true);
    try { setPerf(await api.portfolioPerf(tickers)); } catch { /* stale */ } finally { setLoadingPerf(false); }
  }, []);

  useEffect(() => {
    const pos = loadPortfolio();
    setPositions(pos);
    loadPerf(pos);
  }, [loadPerf]);

  // ── Enriched positions ────────────────────────────────────────────────────

  const enriched = useMemo(() => {
    const today = new Date();
    return positions.map((pos) => {
      const p = perf[pos.ticker];
      const currentPrice = p?.currentPrice ?? pos.buyPrice;
      const currentValue = pos.lots * currentPrice;
      const investedValue = pos.lots * pos.buyPrice;
      const pnl = currentValue - investedValue;
      const pnlPct = investedValue !== 0 ? (pnl / investedValue) * 100 : null;
      const periodKey = periodChangeKey(period);
      const periodPct: number | null =
        period === "all" ? pnlPct
        : periodKey && p ? (p[periodKey] as number | null)
        : null;
      const periodPnl: number | null =
        period === "all" ? pnl
        : periodKey && p && (p[periodKey] as number | null) != null
        ? currentValue * ((p[periodKey] as number) / 100)
        : null;
      const daysSinceBuy = pos.buyDate
        ? Math.max(1, Math.round((today.getTime() - new Date(pos.buyDate).getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      const annualizedReturn = daysSinceBuy != null && pnlPct != null
        ? (Math.pow(1 + pnlPct / 100, 365 / daysSinceBuy) - 1) * 100
        : null;
      return { ...pos, currentPrice, currentValue, investedValue, pnl, pnlPct, periodPct, periodPnl, hasPerf: !!p, daysSinceBuy, annualizedReturn };
    });
  }, [positions, perf, period]);

  // ── Sıralama ──────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let diff = 0;
      if (sortKey === "value") diff = a.currentValue - b.currentValue;
      else if (sortKey === "pnl") diff = a.pnl - b.pnl;
      else if (sortKey === "pnlPct") diff = (a.pnlPct ?? -Infinity) - (b.pnlPct ?? -Infinity);
      else diff = (a.periodPct ?? -Infinity) - (b.periodPct ?? -Infinity);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [enriched, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Özet hesaplamalar ────────────────────────────────────────────────────

  const tryPositions = enriched.filter((p) => p.currency === "TRY");
  const usdPositions = enriched.filter((p) => p.currency === "USD");

  const summaryFor = (grp: typeof enriched) => {
    const invested = grp.reduce((s, p) => s + p.investedValue, 0);
    const current = grp.reduce((s, p) => s + p.currentValue, 0);
    const pnl = current - invested;
    const pnlPct = invested !== 0 ? (pnl / invested) * 100 : null;
    let periodPnl = 0, periodBase = 0;
    grp.forEach((p) => {
      const key = periodChangeKey(period);
      const pData = perf[p.ticker];
      if (period === "all") { periodPnl += p.pnl; periodBase += p.investedValue; }
      else if (key && pData && (pData[key] as number | null) != null) {
        const prev = p.currentValue / (1 + (pData[key] as number) / 100);
        periodPnl += p.currentValue - prev; periodBase += prev;
      }
    });
    const periodPct = periodBase !== 0 ? (periodPnl / periodBase) * 100 : null;
    return { invested, current, pnl, pnlPct, periodPnl, periodPct };
  };

  const trySummary = summaryFor(tryPositions);
  const usdSummary = summaryFor(usdPositions);

  // ── Risk metrikleri (client-side) ─────────────────────────────────────────

  const riskMetrics = useMemo(() => {
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
    if (totalValue === 0 || enriched.length === 0) return null;

    // Ticker bazında ağırlıklar (aynı ticker'ın birden fazla pozisyonu olabilir)
    const tickerWeights = new Map<string, number>();
    enriched.forEach((p) => {
      tickerWeights.set(p.ticker, (tickerWeights.get(p.ticker) ?? 0) + p.currentValue / totalValue);
    });

    const weights = Array.from(tickerWeights.values());
    const hhi = weights.reduce((s, w) => s + w * w, 0);
    const n = tickerWeights.size;
    const minHhi = n > 1 ? 1.0 / n : 1.0;
    const safeRange = Math.max(1.0 - minHhi, 0.001);
    const divScore = n > 1 ? Math.round(Math.max(0, Math.min(100, (1 - (hhi - minHhi) / safeRange) * 100))) : 0;
    const topW = Math.max(...weights);
    const topTicker = Array.from(tickerWeights.entries()).find(([, v]) => v === topW)?.[0] ?? "";

    const bistCount = enriched.filter((p) => p.market === "BIST").length;
    const usCount = enriched.filter((p) => p.market === "US").length;
    const bistValue = enriched.filter((p) => p.market === "BIST").reduce((s, p) => s + p.currentValue, 0);
    const usValue = enriched.filter((p) => p.market === "US").reduce((s, p) => s + p.currentValue, 0);

    return { hhi, divScore, topW, topTicker, n, bistCount, usCount, bistValue, usValue, totalValue };
  }, [enriched]);

  // ── Portföy analizi ───────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async () => {
    if (enriched.length === 0) return;
    setLoadingAnalysis(true); setAnalysisError("");
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);

    // Ticker bazında ağırlık
    const tickerWeights = new Map<string, number>();
    enriched.forEach((p) => {
      tickerWeights.set(p.ticker, (tickerWeights.get(p.ticker) ?? 0) + (totalValue > 0 ? p.currentValue / totalValue : 1 / enriched.length));
    });

    const tickers = Array.from(tickerWeights.keys());
    const weights = tickers.map((t) => tickerWeights.get(t)!);

    try {
      const data = await api.portfolioAnalysis(tickers, weights);
      setAnalysis(data);
    } catch {
      setAnalysisError("Analiz yüklenemedi. Backend çalışıyor mu?");
    } finally {
      setLoadingAnalysis(false);
    }
  }, [enriched]);

  // Tab değişince analizi yükle
  useEffect(() => {
    if ((tab === "risk" || tab === "longterm") && positions.length > 0 && !analysis && !loadingAnalysis) {
      fetchAnalysis();
    }
  }, [tab, positions.length, analysis, loadingAnalysis, fetchAnalysis]);

  // Analiz invalidate (pozisyon değişince)
  const invalidateAnalysis = () => setAnalysis(null);

  // ── Dağılım grafiği ───────────────────────────────────────────────────────

  const allocationData = useMemo(() => {
    const total = enriched.reduce((s, p) => s + p.currentValue, 0);
    if (total === 0) return [];
    return sorted.map((p, i) => ({
      label: p.ticker.replace(".IS", ""),
      value: p.currentValue,
      pct: (p.currentValue / total) * 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).slice(0, 10);
  }, [enriched, sorted]);

  const maxAbsPeriod = useMemo(() => Math.max(...enriched.map((p) => Math.abs(p.periodPct ?? 0)), 0.001), [enriched]);

  // ── Handler'lar ───────────────────────────────────────────────────────────

  const handleAdd = useCallback((pos: Omit<PortfolioPosition, "id">) => {
    const newPos = addPosition(pos);
    const updated = [...positions, newPos];
    setPositions(updated); setShowAdd(false);
    loadPerf(updated); invalidateAnalysis();
  }, [positions, loadPerf]);

  const handleEdit = useCallback((pos: Omit<PortfolioPosition, "id">) => {
    if (!editPos) return;
    updatePosition(editPos.id, pos);
    const updated = loadPortfolio();
    setPositions(updated); setEditPos(null);
    loadPerf(updated); invalidateAnalysis();
  }, [editPos, loadPerf]);

  const handleDelete = useCallback((id: string) => {
    removePosition(id);
    const updated = loadPortfolio();
    setPositions(updated); setConfirmDelete(null);
    loadPerf(updated); invalidateAnalysis();
  }, [loadPerf]);

  // ── Yardımcı bileşenler ───────────────────────────────────────────────────

  const AnalysisLoading = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 size={32} color="var(--accent-primary)" strokeWidth={1.8} className="animate-spin" />
      <div className="text-center">
        <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-semibold">Analiz Yükleniyor</p>
        <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-1">
          Her hisse için derin analiz yapılıyor. İlk yükleme 10–20 sn sürebilir.
        </p>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">Sonraki açılışlarda önbellekten anında yüklenir.</p>
      </div>
    </div>
  );

  const AnalysisError = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle size={28} color="var(--down)" strokeWidth={1.8} />
      <p style={{ color: "var(--text-secondary)" }} className="text-[13px]">{analysisError}</p>
      <button onClick={fetchAnalysis} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        Tekrar Dene
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GENEL BAKIŞ TAB
  // ─────────────────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ...(tryPositions.length > 0 ? [{ label: "TL Değer", value: fmtBig(trySummary.current, "TRY"), sub: `${fmtBig(trySummary.invested, "TRY")} yatırıldı`, pct: trySummary.pnlPct, pnl: fmtBig(trySummary.pnl, "TRY") }] : []),
          ...(usdPositions.length > 0 ? [{ label: "USD Değer", value: fmtBig(usdSummary.current, "USD"), sub: `${fmtBig(usdSummary.invested, "USD")} yatırıldı`, pct: usdSummary.pnlPct, pnl: fmtBig(usdSummary.pnl, "USD") }] : []),
          ...(tryPositions.length > 0 ? [{ label: `${PERIOD_LABELS[period]} K/Z (TL)`, value: fmtBig(trySummary.periodPnl, "TRY"), sub: null, pct: trySummary.periodPct, pnl: null }] : []),
          ...(usdPositions.length > 0 ? [{ label: `${PERIOD_LABELS[period]} K/Z (USD)`, value: fmtBig(usdSummary.periodPnl, "USD"), sub: null, pct: usdSummary.periodPct, pnl: null }] : []),
        ].map((card, i) => {
          const isUp = card.pct == null || card.pct >= 0;
          return (
            <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-2">{card.label}</p>
              <p style={{ color: "var(--text-primary)" }} className="text-[22px] font-bold tabular-nums leading-tight">{card.value}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {card.pct != null && (
                  <span style={{ background: isUp ? "var(--up-bg)" : "var(--down-bg)", color: isUp ? "var(--up)" : "var(--down)", borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: "1px 7px" }}>
                    {fmtPct(card.pct)}
                  </span>
                )}
                {card.pnl != null && <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[11px] font-medium tabular-nums">{card.pnl}</span>}
                {card.sub && <span style={{ color: "var(--text-muted)" }} className="text-[11px]">{card.sub}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pozisyonlar Tablosu */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
        <div style={{ borderBottom: "1px solid var(--border)" }} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">
            Pozisyonlar
            {loadingPerf && <span style={{ color: "var(--text-muted)" }} className="text-[11px] font-normal ml-2">güncelleniyor...</span>}
          </p>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px]">Başlığa tıklayarak sırala</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                {[
                  { label: "Hisse", key: null, left: true },
                  { label: "Lot", key: null },
                  { label: "Alış", key: null },
                  { label: "Şuanki", key: null },
                  { label: "Piyasa Değeri", key: "value" as const },
                  { label: "K/Z", key: "pnl" as const },
                  { label: "K/Z %", key: "pnlPct" as const },
                  { label: "Yıl. Getiri", key: null },
                  { label: "Tutuş", key: null },
                  { label: PERIOD_LABELS[period], key: "period" as const },
                  { label: "", key: null },
                ].map((col, i) => (
                  <th key={i}
                    className={`${col.left ? "text-left px-5" : "text-right px-3"} py-2.5`}
                    style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", cursor: col.key ? "pointer" : "default", userSelect: "none" }}
                    onClick={() => col.key && toggleSort(col.key)}
                  >
                    <span className={`flex items-center gap-0.5 ${col.left ? "" : "justify-end"}`}>
                      {col.label}
                      {col.key && sortKey === col.key && (
                        sortDir === "desc" ? <ChevronDown size={11} strokeWidth={2.5} color="var(--accent-primary)" /> : <ChevronUp size={11} strokeWidth={2.5} color="var(--accent-primary)" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pos, i) => {
                const isUp = pos.pnl >= 0;
                return (
                  <tr key={pos.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-5 py-3">
                      <div className="cursor-pointer" onClick={() => router.push(`/stock/${pos.ticker}`)}>
                        <p style={{ color: "var(--accent-primary)" }} className="text-[13px] font-bold leading-tight hover:underline">{pos.ticker.replace(".IS", "")}</p>
                        <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate max-w-[160px]">{pos.name}</p>
                        {pos.notes && <p style={{ color: "var(--text-muted)" }} className="text-[10px] truncate max-w-[160px] mt-0.5 italic">{pos.notes}</p>}
                      </div>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums">{pos.lots % 1 === 0 ? pos.lots.toLocaleString("tr") : pos.lots.toFixed(3)}</span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums">{formatPrice(pos.buyPrice, pos.currency)}</span>
                      <p style={{ color: "var(--text-muted)" }} className="text-[10px]">{pos.buyDate}</p>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums">{pos.hasPerf ? formatPrice(pos.currentPrice, pos.currency) : "—"}</span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold tabular-nums">{fmtBig(pos.currentValue, pos.currency)}</span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ color: isUp ? "var(--up)" : "var(--down)" }} className="text-[12px] font-medium tabular-nums">{fmtBig(pos.pnl, pos.currency)}</span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <span style={{ background: isUp ? "var(--up-bg)" : "var(--down-bg)", color: isUp ? "var(--up)" : "var(--down)", borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: "2px 7px" }}>
                        {fmtPct(pos.pnlPct)}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3">
                      {pos.annualizedReturn != null ? (
                        <span style={{ color: pos.annualizedReturn >= 0 ? "var(--up)" : "var(--down)", fontSize: 12, fontWeight: 600 }} className="tabular-nums">
                          {fmtPct(pos.annualizedReturn)}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>}
                    </td>
                    <td className="text-right px-3 py-3">
                      {pos.daysSinceBuy != null ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }} className="tabular-nums">
                          {pos.daysSinceBuy >= 365
                            ? `${(pos.daysSinceBuy / 365).toFixed(1)}y`
                            : pos.daysSinceBuy >= 30
                            ? `${Math.round(pos.daysSinceBuy / 30)}ay`
                            : `${pos.daysSinceBuy}g`}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>}
                    </td>
                    <td className="text-right px-3 py-3"><PerfBar value={pos.periodPct} maxAbs={maxAbsPeriod} /></td>
                    <td className="text-right px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditPos(pos)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }} className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all" title="Düzenle">
                          <Pencil size={13} strokeWidth={1.8} />
                        </button>
                        {confirmDelete === pos.id ? (
                          <button onClick={() => handleDelete(pos.id)} style={{ background: "var(--down-bg)", border: "none", color: "var(--down)", cursor: "pointer", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }} onBlur={() => setConfirmDelete(null)} autoFocus>
                            Sil?
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDelete(pos.id)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }} className="p-1.5 rounded-md hover:bg-[var(--down-bg)] hover:text-[var(--down)] transition-all" title="Sil">
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

      {/* Performans Özeti */}
      {enriched.length > 0 && (() => {
        const totalInvested = enriched.reduce((s, p) => s + p.investedValue, 0);
        const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
        const totalPnlPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null;
        const winCount = enriched.filter((p) => p.pnl > 0).length;
        const loseCount = enriched.filter((p) => p.pnl < 0).length;
        const bestPos = enriched.reduce((best, p) => (p.pnlPct ?? -Infinity) > (best.pnlPct ?? -Infinity) ? p : best, enriched[0]);
        const worstPos = enriched.reduce((worst, p) => (p.pnlPct ?? Infinity) < (worst.pnlPct ?? Infinity) ? p : worst, enriched[0]);
        const avgHolding = enriched.filter((p) => p.daysSinceBuy).reduce((s, p) => s + (p.daysSinceBuy ?? 0), 0) / (enriched.filter((p) => p.daysSinceBuy).length || 1);
        return (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-4">Performans Özeti</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
              {[
                { label: "Kazanma Oranı", value: enriched.length > 0 ? `${Math.round((winCount / enriched.length) * 100)}%` : "—", sub: `${winCount} kâr / ${loseCount} zarar`, color: winCount >= loseCount ? "var(--up)" : "var(--down)" },
                { label: "Toplam Getiri", value: fmtPct(totalPnlPct), sub: fmtBig(totalValue - totalInvested, tryPositions.length >= usdPositions.length ? "TRY" : "USD"), color: (totalPnlPct ?? 0) >= 0 ? "var(--up)" : "var(--down)" },
                { label: "En İyi Hisse", value: fmtPct(bestPos?.pnlPct), sub: bestPos?.ticker.replace(".IS", "") ?? "—", color: "var(--up)" },
                { label: "En Kötü Hisse", value: fmtPct(worstPos?.pnlPct), sub: worstPos?.ticker.replace(".IS", "") ?? "—", color: "var(--down)" },
                { label: "Ort. Tutuş", value: avgHolding >= 365 ? `${(avgHolding / 365).toFixed(1)}y` : avgHolding >= 30 ? `${Math.round(avgHolding / 30)}ay` : `${Math.round(avgHolding)}g`, sub: "ortalama", color: "var(--text-primary)" },
              ].map((stat, i) => (
                <div key={i}>
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-1">{stat.label}</p>
                  <p style={{ color: stat.color, fontSize: 18, fontWeight: 800 }} className="tabular-nums leading-tight">{stat.value}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
            {/* Katkı Analizi */}
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">Portföy Katkı Analizi</p>
            <div className="space-y-2">
              {[...enriched].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).map((pos) => {
                const contrib = totalInvested > 0 ? (pos.pnl / totalInvested) * 100 : 0;
                const maxContrib = enriched.reduce((m, p) => Math.max(m, Math.abs(totalInvested > 0 ? (p.pnl / totalInvested) * 100 : 0)), 0.001);
                const barPct = Math.min(Math.abs(contrib) / maxContrib, 1) * 100;
                const isPos = contrib >= 0;
                return (
                  <div key={pos.id} className="flex items-center gap-3">
                    <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, width: 60, flexShrink: 0 }} className="truncate">{pos.ticker.replace(".IS", "")}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                      <div style={{ width: `${barPct}%`, height: "100%", background: isPos ? "var(--up)" : "var(--down)", borderRadius: 4 }} />
                    </div>
                    <span style={{ color: isPos ? "var(--up)" : "var(--down)", fontSize: 11, fontWeight: 700, width: 56, textAlign: "right" }} className="tabular-nums">
                      {contrib >= 0 ? "+" : ""}{contrib.toFixed(2)}pp
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, width: 56, textAlign: "right" }} className="tabular-nums">
                      {fmtBig(pos.pnl, pos.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3">pp = yüzde puan katkı (toplam yatırıma göre)</p>
          </div>
        );
      })()}

      {/* Grafikler */}
      {enriched.length >= 2 && allocationData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-4">Portföy Dağılımı</p>
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
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-4">{PERIOD_LABELS[period]} Getiri Karşılaştırması</p>
            <div className="space-y-2">
              {sorted.map((pos) => (
                <div key={pos.id} className="flex items-center gap-3">
                  <span style={{ color: "var(--text-secondary)", width: 60 }} className="text-[11px] font-medium shrink-0 truncate">{pos.ticker.replace(".IS", "")}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                    {pos.periodPct != null && maxAbsPeriod > 0 && (
                      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(pos.periodPct) / maxAbsPeriod, 1) * 100}%`, background: pos.periodPct >= 0 ? "var(--up)" : "var(--down)" }} />
                    )}
                  </div>
                  <span style={{ color: pos.periodPct == null ? "var(--text-muted)" : pos.periodPct >= 0 ? "var(--up)" : "var(--down)", width: 56 }} className="text-[11px] font-semibold tabular-nums text-right">
                    {fmtPct(pos.periodPct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SEKTÖR & RİSK TAB
  // ─────────────────────────────────────────────────────────────────────────

  const renderRisk = () => {
    if (loadingAnalysis) return <AnalysisLoading />;
    if (analysisError) return <AnalysisError />;

    const rm = riskMetrics;
    const sectors = analysis?.sectorBreakdown ?? {};
    const sectorEntries = Object.entries(sectors);
    const maxSectorW = sectorEntries.reduce((m, [, v]) => Math.max(m, v), 0);

    const sectorColors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#8b5cf6", "#84cc16", "#ec4899", "#64748b"];

    return (
      <div className="space-y-5">
        {/* Özet Risk Kartları */}
        {rm && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Hisse Sayısı", value: `${rm.n}`, sub: `${analysis?.sectorCount ?? "—"} sektör`,
                icon: <Layers size={18} color="var(--accent-primary)" strokeWidth={1.8} />,
              },
              {
                label: "En Büyük Pozisyon", value: `${(rm.topW * 100).toFixed(1)}%`,
                sub: rm.topTicker.replace(".IS", ""),
                icon: <TrendingUp size={18} color={rm.topW > 0.4 ? "var(--down)" : rm.topW > 0.25 ? "var(--warn)" : "var(--up)"} strokeWidth={1.8} />,
              },
              {
                label: "BIST / ABD", value: `${rm.bistCount} / ${rm.usCount}`,
                sub: `₺${((rm.bistValue / rm.totalValue) * 100).toFixed(0)}% — $${((rm.usValue / rm.totalValue) * 100).toFixed(0)}%`,
                icon: <BarChart3 size={18} color="var(--accent-secondary)" strokeWidth={1.8} />,
              },
              {
                label: "Konsantrasyon", value: analysis?.concentrationLabel ?? (rm.hhi < 0.15 ? "Düşük" : rm.hhi < 0.25 ? "Orta" : "Yüksek"),
                sub: `HHI: ${rm.hhi.toFixed(3)}`,
                icon: <ShieldCheck size={18} color={analysis?.concentrationColor === "up" ? "var(--up)" : analysis?.concentrationColor === "down" ? "var(--down)" : "var(--warn)"} strokeWidth={1.8} />,
              },
            ].map((card, i) => (
              <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">{card.label}</p>
                  {card.icon}
                </div>
                <p style={{ color: "var(--text-primary)" }} className="text-[20px] font-bold tabular-nums leading-tight">{card.value}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Performans İstatistikleri */}
        {rm && (() => {
          const validAnn = enriched.filter((p) => p.annualizedReturn != null);
          const avgAnn = validAnn.length > 0 ? validAnn.reduce((s, p) => s + (p.annualizedReturn ?? 0), 0) / validAnn.length : null;
          const winRate = enriched.length > 0 ? Math.round((enriched.filter((p) => p.pnl > 0).length / enriched.length) * 100) : null;
          const avgHoldingDays = enriched.filter((p) => p.daysSinceBuy).reduce((s, p) => s + (p.daysSinceBuy ?? 0), 0) / (enriched.filter((p) => p.daysSinceBuy).length || 1);
          const bestAnn = validAnn.reduce((b, p) => (p.annualizedReturn ?? -Infinity) > (b.annualizedReturn ?? -Infinity) ? p : b, validAnn[0]);
          const totalInvested = enriched.reduce((s, p) => s + p.investedValue, 0);
          const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
          const totalPnlPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null;
          return (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
              <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mb-4">Performans İstatistikleri</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Kazanma Oranı", value: winRate != null ? `${winRate}%` : "—",
                    sub: `${enriched.filter((p) => p.pnl > 0).length} kâr / ${enriched.filter((p) => p.pnl < 0).length} zarar`,
                    color: winRate != null ? (winRate >= 60 ? "var(--up)" : winRate >= 40 ? "var(--warn)" : "var(--down)") : "var(--text-primary)",
                  },
                  {
                    label: "Ort. Yıllık Getiri", value: avgAnn != null ? fmtPct(avgAnn) : "—",
                    sub: "pozisyon ortalaması",
                    color: avgAnn != null ? (avgAnn >= 0 ? "var(--up)" : "var(--down)") : "var(--text-primary)",
                  },
                  {
                    label: "Toplam Portföy Getirisi", value: fmtPct(totalPnlPct),
                    sub: "alıştan bugüne",
                    color: (totalPnlPct ?? 0) >= 0 ? "var(--up)" : "var(--down)",
                  },
                  {
                    label: "Ort. Tutuş Süresi",
                    value: avgHoldingDays >= 365 ? `${(avgHoldingDays / 365).toFixed(1)} yıl` : avgHoldingDays >= 30 ? `${Math.round(avgHoldingDays / 30)} ay` : `${Math.round(avgHoldingDays)} gün`,
                    sub: bestAnn ? `En yüksek yıl. getiri: ${bestAnn.ticker.replace(".IS", "")}` : "—",
                    color: "var(--text-primary)",
                  },
                ].map((stat, i) => (
                  <div key={i} style={{ background: "var(--bg-tertiary)", borderRadius: 10 }} className="p-3">
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-1.5">{stat.label}</p>
                    <p style={{ color: stat.color, fontSize: 20, fontWeight: 800, lineHeight: 1 }} className="tabular-nums">{stat.value}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1">{stat.sub}</p>
                  </div>
                ))}
              </div>
              {/* Yıllık getiri karşılaştırması */}
              {validAnn.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Yıllık Getiri Karşılaştırması</p>
                  {[...validAnn].sort((a, b) => (b.annualizedReturn ?? 0) - (a.annualizedReturn ?? 0)).map((pos) => {
                    const maxAbs = validAnn.reduce((m, p) => Math.max(m, Math.abs(p.annualizedReturn ?? 0)), 0.001);
                    const barPct = Math.min(Math.abs(pos.annualizedReturn ?? 0) / maxAbs, 1) * 100;
                    const isPos = (pos.annualizedReturn ?? 0) >= 0;
                    return (
                      <div key={pos.id} className="flex items-center gap-3">
                        <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, width: 60, flexShrink: 0 }} className="truncate">{pos.ticker.replace(".IS", "")}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                          <div style={{ width: `${barPct}%`, height: "100%", background: isPos ? "var(--up)" : "var(--down)", borderRadius: 4 }} />
                        </div>
                        <span style={{ color: isPos ? "var(--up)" : "var(--down)", fontSize: 11, fontWeight: 700, width: 64, textAlign: "right" }} className="tabular-nums">
                          {fmtPct(pos.annualizedReturn)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Çeşitlendirme Göstergesi */}
          {rm && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 space-y-5">
              <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Çeşitlendirme Analizi</p>

              <DiversificationMeter score={rm.divScore} />

              {/* Piyasa Dağılımı */}
              <div className="space-y-3">
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Piyasa Dağılımı</p>
                <div className="space-y-2">
                  {rm.bistValue > 0 && (
                    <SectorBar label="BIST (Borsa İstanbul)" weight={rm.bistValue / rm.totalValue} color="#6366f1" />
                  )}
                  {rm.usValue > 0 && (
                    <SectorBar label="ABD Borsası" weight={rm.usValue / rm.totalValue} color="#22c55e" />
                  )}
                </div>
              </div>

              {/* Öneriler */}
              <div style={{ background: "var(--bg-tertiary)", borderRadius: 10 }} className="p-3 space-y-2">
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-2">Değerlendirme</p>
                {rm.topW > 0.4 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} color="var(--down)" strokeWidth={2} className="mt-0.5 shrink-0" />
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">{rm.topTicker.replace(".IS", "")} pozisyonu portföyün <strong>{(rm.topW * 100).toFixed(0)}%</strong>'ini oluşturuyor — yüksek konsantrasyon.</p>
                  </div>
                )}
                {rm.topW > 0.25 && rm.topW <= 0.4 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} color="var(--warn)" strokeWidth={2} className="mt-0.5 shrink-0" />
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">{rm.topTicker.replace(".IS", "")} pozisyonu <strong>{(rm.topW * 100).toFixed(0)}%</strong> — orta konsantrasyon.</p>
                  </div>
                )}
                {rm.n < 5 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} color="var(--warn)" strokeWidth={2} className="mt-0.5 shrink-0" />
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">Yalnızca <strong>{rm.n}</strong> hisse var — en az 8-10 farklı pozisyon çeşitlendirme sağlar.</p>
                  </div>
                )}
                {rm.bistCount > 0 && rm.usCount === 0 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} color="var(--warn)" strokeWidth={2} className="mt-0.5 shrink-0" />
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">Tüm pozisyonlar BIST'te — döviz bazlı varlık eklemek kur riskini dengeler.</p>
                  </div>
                )}
                {rm.divScore >= 65 && rm.topW <= 0.25 && rm.n >= 5 && (
                  <div className="flex items-start gap-2">
                    <Check size={13} color="var(--up)" strokeWidth={2} className="mt-0.5 shrink-0" />
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">Çeşitlendirme düzeyi iyi, konsantrasyon riski düşük.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sektör Dağılımı */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Sektör Dağılımı</p>
              {!analysis && !loadingAnalysis && (
                <button onClick={fetchAnalysis} style={{ background: "var(--accent-muted)", border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)", color: "var(--accent-primary)", borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Yükle
                </button>
              )}
            </div>
            {!analysis ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Layers size={28} color="var(--text-muted)" strokeWidth={1.5} />
                <p style={{ color: "var(--text-muted)" }} className="text-[12px] text-center">Sektör bilgisi için analiz yükle</p>
              </div>
            ) : sectorEntries.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Sektör verisi bulunamadı.</p>
            ) : (
              <div className="space-y-2.5">
                {sectorEntries.map(([sector, weight], i) => (
                  <SectorBar key={sector} label={sector} weight={weight} color={sectorColors[i % sectorColors.length]} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UZUN VADE SKORU TAB
  // ─────────────────────────────────────────────────────────────────────────

  const renderLongTerm = () => {
    if (loadingAnalysis) return <AnalysisLoading />;
    if (analysisError) return <AnalysisError />;
    if (!analysis) return null;

    const bd = analysis.portfolioBreakdown;
    const posMap = new Map<string, PortfolioPositionAnalysis>(analysis.positions.map((p) => [p.ticker, p]));

    // Verdikleri renk: up=yeşil, warn=sarı, down=kırmızı
    const verdictBg: Record<string, string> = {
      "Çok Cazip": "rgba(34,197,94,0.12)", Cazip: "rgba(34,197,94,0.08)",
      Tut: "rgba(245,158,11,0.10)", Pahalı: "rgba(245,158,11,0.10)", Kaçın: "rgba(239,68,68,0.12)",
    };

    return (
      <div className="space-y-5">
        {/* Portföy Skoru Kartı */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award size={16} color="var(--accent-primary)" strokeWidth={1.8} />
            <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-semibold">Portföy Uzun Vade Skoru</p>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Gauge */}
            <div className="shrink-0">
              <ScoreGauge score={analysis.portfolioScore} verdict={analysis.portfolioVerdict} color={analysis.portfolioVerdictColor} size="lg" />
            </div>
            {/* Breakdown */}
            <div className="flex-1 space-y-4 w-full">
              <ScoreBar label="Kalite (Piotroski + Marjlar)" value={bd.quality} />
              <ScoreBar label="Değer (F/K, EV/EBITDA, DCF)" value={bd.value} />
              <ScoreBar label="Büyüme (Hasılat + Kazanç)" value={bd.growth} />
              <ScoreBar label="Temettü Getirisi" value={bd.yield} />
            </div>
            {/* Interpretation */}
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 12, minWidth: 200 }} className="p-4 shrink-0">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">Yorumlama</p>
              {[
                { range: "75–100", label: "Çok Cazip", c: "var(--up)" },
                { range: "60–74", label: "Cazip", c: "var(--up)" },
                { range: "45–59", label: "Tut", c: "var(--warn)" },
                { range: "30–44", label: "Pahalı", c: "var(--warn)" },
                { range: "0–29", label: "Kaçın", c: "var(--down)" },
              ].map((r) => (
                <div key={r.range} className="flex items-center justify-between py-1">
                  <span style={{ color: "var(--text-muted)" }} className="text-[11px]">{r.range}</span>
                  <span style={{ color: r.c, fontWeight: 600 }} className="text-[11px]">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-4">
            Skor, portföydeki her hissenin piyasa değeri ağırlığıyla hesaplanmış <strong>Composite Uzun Vade Skoru</strong>'nun ortalamasıdır.
            4 bileşen: Finansal kalite, değerleme cazibeyi, büyüme ivmesi ve temettü getirisi.
          </p>
        </div>

        {/* Hisse Bazında Skorlar */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          <div style={{ borderBottom: "1px solid var(--border)" }} className="px-5 py-3">
            <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Hisse Bazında Uzun Vade Skorları</p>
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">Ağırlığa göre portföy skoruna katkı</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                  {["Hisse", "Sektör", "Ağırlık", "Skor", "Kalite", "Değer", "Büyüme", "Temettü", "Değerlendirme"].map((h, i) => (
                    <th key={i} className={`${i === 0 ? "text-left px-5" : "text-center px-3"} py-2.5`} style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((pos, i) => {
                  const pa = posMap.get(pos.ticker);
                  const hasScore = pa?.compositeScore != null;
                  const bd2 = pa?.breakdown;
                  return (
                    <tr key={pos.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-5 py-3">
                        <div className="cursor-pointer" onClick={() => router.push(`/stock/${pos.ticker}`)}>
                          <p style={{ color: "var(--accent-primary)" }} className="text-[13px] font-bold hover:underline">{pos.ticker.replace(".IS", "")}</p>
                          <p style={{ color: "var(--text-muted)" }} className="text-[10px] truncate max-w-[130px]">{pos.name}</p>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{pa?.sector ?? "—"}</span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span style={{ color: "var(--text-secondary)" }} className="text-[12px] font-semibold tabular-nums">
                          {((pa?.weight ?? 0) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        {hasScore ? (
                          <ScoreGauge score={pa!.compositeScore!} verdict="" color={pa!.verdictColor} size="sm" />
                        ) : (
                          <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>
                        )}
                      </td>
                      {[bd2?.quality, bd2?.value, bd2?.growth, bd2?.yield].map((v, j) => (
                        <td key={j} className="text-center px-3 py-3">
                          {v != null ? (
                            <div className="flex flex-col items-center gap-1">
                              <span style={{ color: v >= 65 ? "var(--up)" : v >= 45 ? "var(--warn)" : "var(--down)", fontSize: 12, fontWeight: 700 }}>{v}</span>
                              <div style={{ width: 36, height: 3, background: "var(--bg-tertiary)", borderRadius: 2 }}>
                                <div style={{ width: `${v}%`, height: "100%", background: v >= 65 ? "var(--up)" : v >= 45 ? "var(--warn)" : "var(--down)", borderRadius: 2 }} />
                              </div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>}
                        </td>
                      ))}
                      <td className="text-center px-3 py-3">
                        {pa?.compositeVerdict && pa.compositeVerdict !== "Veri Yok" ? (
                          <span style={{ background: verdictBg[pa.compositeVerdict] ?? "var(--bg-tertiary)", color: verdictColor(pa.verdictColor), borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "3px 8px", whiteSpace: "nowrap" }}>
                            {pa.compositeVerdict}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }} className="text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Yenile */}
        <div className="flex justify-end">
          <button onClick={fetchAnalysis} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer" }} className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-all">
            <RefreshCw size={12} strokeWidth={1.8} />
            Analizi Yenile
          </button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const isEmpty = positions.length === 0;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Genel Bakış", icon: <BarChart3 size={13} strokeWidth={1.8} /> },
    { key: "risk", label: "Sektör & Risk", icon: <ShieldCheck size={13} strokeWidth={1.8} /> },
    { key: "longterm", label: "Uzun Vade Skoru", icon: <Award size={13} strokeWidth={1.8} /> },
  ];

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">
      {/* Header */}
      <header style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(20px)" }} className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div style={{ background: "var(--brand-gradient)", width: 26, height: 26 }} className="rounded-lg flex items-center justify-center">
            <BarChart3 size={15} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ color: "var(--text-primary)" }} className="text-[15px] font-semibold">InvestmentAI</span>
        </Link>
        <Link href="/" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:text-[var(--text-primary)] transition-all">
          <ArrowLeft size={13} strokeWidth={1.8} /> Ana Sayfa
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {positions.length > 0 && (
            <button onClick={() => { loadPerf(positions); invalidateAnalysis(); setAnalysis(null); }} disabled={loadingPerf}
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer hover:text-[var(--text-primary)] transition-all">
              <RefreshCw size={13} strokeWidth={1.8} className={loadingPerf ? "animate-spin" : ""} /> Güncelle
            </button>
          )}
          <button onClick={() => setShowAdd(true)} style={{ background: "var(--accent-primary)", color: "#fff", border: "none" }} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer hover:opacity-90 transition-all">
            <Plus size={14} strokeWidth={2.5} /> Pozisyon Ekle
          </button>
          <button onClick={toggle} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:text-[var(--text-primary)] transition-all">
            {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-5 py-6 space-y-5">
        {/* Başlık + Sekmeler */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 style={{ color: "var(--text-primary)" }} className="text-[22px] font-bold tracking-tight">Portföy Analizi</h1>
            <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-0.5">
              {positions.length > 0 ? `${positions.length} pozisyon · Veriler 5 dk önbelleğe alınmıştır` : "Portföyünüzü oluşturun"}
            </p>
          </div>
          {positions.length > 0 && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="flex rounded-xl p-[3px] gap-[2px]">
              {(["all", "1d", "1w", "1m", "1y"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{ background: period === p ? "var(--accent-muted)" : "transparent", color: period === p ? "var(--accent-primary)" : "var(--text-muted)", border: period === p ? "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "1px solid transparent", borderRadius: 8, padding: "4px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Navigasyonu */}
        {!isEmpty && (
          <div style={{ borderBottom: "1px solid var(--border)" }} className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "transparent", border: "none",
                  borderBottom: tab === t.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
                  color: tab === t.key ? "var(--accent-primary)" : "var(--text-muted)",
                  padding: "8px 16px", fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}
                className="flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors"
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Boş state */}
        {isEmpty && (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", maxWidth: 480, margin: "60px auto 0" }} className="rounded-2xl p-10 text-center">
            <div style={{ width: 56, height: 56, background: "var(--accent-muted)" }} className="rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={26} color="var(--accent-primary)" strokeWidth={1.8} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-[16px] font-semibold mb-2">Portföyünüz Boş</h2>
            <p style={{ color: "var(--text-muted)" }} className="text-[13px] leading-relaxed mb-5">
              BIST veya ABD borsasından hisse ekleyerek getiri takibine başlayın. Veriler tarayıcınızda saklanır.
            </p>
            <button onClick={() => setShowAdd(true)} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} strokeWidth={2.5} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              İlk Pozisyonu Ekle
            </button>
          </div>
        )}

        {/* Tab İçerikleri */}
        {!isEmpty && tab === "overview" && renderOverview()}
        {!isEmpty && tab === "risk" && renderRisk()}
        {!isEmpty && tab === "longterm" && renderLongTerm()}
      </main>

      {/* Modals */}
      {showAdd && <PositionModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {editPos && <PositionModal onClose={() => setEditPos(null)} onSave={handleEdit} initial={editPos} />}
    </div>
  );
}
