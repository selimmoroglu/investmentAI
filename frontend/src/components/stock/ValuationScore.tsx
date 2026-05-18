"use client";

import { useEffect, useState } from "react";
import { api, type Ratios, type Quote } from "@/lib/api";

interface ValuationScoreProps {
  ticker: string;
}

interface ScoreDetail {
  label: string;
  value: string;
  contribution: number; // -100..+100, pozitif = pahalılığa katkı
  note?: string;
}

interface ScoreResult {
  score: number | null;
  label: string;
  color: string;
  details: ScoreDetail[];
  dataCount: number;
}

function isBankTicker(r: Ratios): boolean {
  // EV/EBITDA yoksa ve P/B düşükse muhtemelen banka
  return r.evEbitda == null && r.ps == null && r.pb != null && r.pb < 3;
}

function computeScore(r: Ratios, q: Quote | null): ScoreResult {
  const details: ScoreDetail[] = [];
  let rawScore = 0;
  let dataCount = 0;
  const isBank = isBankTicker(r);

  const fcf = q?.freeCashflow ?? null;
  const mcap = q?.marketCap ?? null;
  const fcfYield = fcf != null && mcap && mcap > 0 ? (fcf / mcap) * 100 : null;
  const eps = q?.eps ?? null;
  const price = q?.currentPrice ?? null;

  // Minimum veri kontrolü
  const hasCoreValuation =
    (r.pe != null && r.pe > 0) ||
    (r.pb != null && r.pb > 0) ||
    (r.evEbitda != null && r.evEbitda > 0) ||
    (fcfYield != null && fcfYield > 0);

  if (!hasCoreValuation) {
    return { score: null, label: "Veri Yetersiz", color: "var(--text-muted)", details: [], dataCount: 0 };
  }

  // --- P/E Oranı ---
  if (r.pe != null && r.pe > 0 && r.pe < 300) {
    let contrib: number;
    if (isBank) {
      // Bankalar için P/E eşikleri: <5 ucuz, 5-10 makul, 10-20 pahalı, >20 çok pahalı
      contrib = Math.max(-10, Math.min(35, (r.pe - 5) / 15 * 35));
    } else {
      // Genel: <10 ucuz, 20 makul, 35 pahalı, 60+ çok pahalı
      contrib = Math.max(-10, Math.min(35, (r.pe - 10) / 30 * 35));
    }
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "F/K (P/E)",
      value: r.pe.toFixed(1) + "x",
      contribution: contrib,
      note: r.pe < 10 ? "Düşük" : r.pe > 30 ? "Yüksek" : "Makul",
    });
  }

  // --- P/B Oranı ---
  if (r.pb != null && r.pb > 0) {
    let contrib: number;
    if (isBank) {
      // Bankalar için P/B kritik: <0.7 çok ucuz, 0.7-1.5 ucuz, 1.5-2.5 makul, >3 pahalı
      contrib = Math.max(-15, Math.min(25, (r.pb - 0.7) / 2.3 * 25));
    } else {
      // Genel: <1 ucuz, 2-3 makul, 5+ pahalı
      contrib = Math.max(-15, Math.min(25, (r.pb - 1) / 4 * 25));
    }
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "PD/DD (P/B)",
      value: r.pb.toFixed(2) + "x",
      contribution: contrib,
      note: isBank ? (r.pb < 1 ? "Defter Altı" : r.pb < 1.5 ? "Ucuz" : "Pahalı") : (r.pb < 1.5 ? "Ucuz" : r.pb > 4 ? "Pahalı" : "Makul"),
    });
  }

  // --- EV/EBITDA (sadece banka dışı) ---
  if (!isBank && r.evEbitda != null && r.evEbitda > 0 && r.evEbitda < 100) {
    const contrib = Math.max(-10, Math.min(25, (r.evEbitda - 5) / 20 * 25));
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "EV/FAVÖK",
      value: r.evEbitda.toFixed(1) + "x",
      contribution: contrib,
      note: r.evEbitda < 8 ? "Ucuz" : r.evEbitda > 20 ? "Pahalı" : "Makul",
    });
  }

  // --- P/S Oranı (sadece banka dışı) ---
  if (!isBank && r.ps != null && r.ps > 0 && r.ps < 50) {
    const contrib = Math.max(-5, Math.min(15, (r.ps - 1) / 9 * 15));
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "F/S (P/S)",
      value: r.ps.toFixed(2) + "x",
      contribution: contrib,
      note: r.ps < 1 ? "Ucuz" : r.ps > 5 ? "Pahalı" : "Makul",
    });
  }

  // --- PEG Oranı ---
  if (r.peg != null && r.peg > 0 && r.peg < 10) {
    const contrib = Math.max(-5, Math.min(15, (r.peg - 0.5) / 2 * 15));
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "PEG",
      value: r.peg.toFixed(2) + "x",
      contribution: contrib,
      note: r.peg < 1 ? "Büyüme Ucuz" : r.peg > 2 ? "Pahalı Büyüme" : "Makul",
    });
  }

  // --- FCF Yield: düşük getiri = pahalı ---
  if (fcfYield != null) {
    // FCF Yield %10+ → çok ucuz (-15 puan), %5 nötr, %1 → pahalı (+10 puan)
    const contrib = Math.max(-15, Math.min(10, (5 - fcfYield) / 5 * 10));
    rawScore += contrib;
    dataCount++;
    details.push({
      label: "FCF Verimi",
      value: fcfYield.toFixed(1) + "%",
      contribution: contrib,
      note: fcfYield > 8 ? "Güçlü Nakit" : fcfYield > 4 ? "Yeterli" : "Zayıf",
    });
  }

  // --- Kalite ayarları (iyi kalite = haklı yüksek fiyat → puanı düşür) ---
  if (r.netMargin != null) {
    if (r.netMargin > 0.25) { rawScore -= 8; }
    else if (r.netMargin > 0.15) { rawScore -= 5; }
    else if (r.netMargin > 0.05) { rawScore -= 2; }
    else if (r.netMargin < 0) { rawScore += 8; }  // zararda = ucuz değil, riskli
  }

  if (r.roe != null && r.roe > 0) {
    const roeAdj = Math.min(r.roe, 0.5);
    rawScore -= roeAdj * 20;  // yüksek ROE haklı değerlemeye işaret
  }

  if (r.revenueGrowth != null && r.revenueGrowth > 0) {
    rawScore -= Math.min(r.revenueGrowth, 0.5) * 15;
  }

  // Borç yükü — yüksek borç pahalılığa ekler (risk)
  if (r.debtToEquity != null && !isBank) {
    if (r.debtToEquity > 200) { rawScore += 8; }
    else if (r.debtToEquity > 100) { rawScore += 4; }
  }

  // Düşük current ratio (likidite riski)
  if (r.currentRatio != null && r.currentRatio < 1 && !isBank) {
    rawScore += 4;
  }

  // Normalize: quality adjustments can push rawScore negative for truly cheap stocks.
  // We clamp to minimum 5 so the progress bar is always visible, then bucket into labels.
  const finalScore = Math.max(5, Math.min(100, Math.round(rawScore)));

  let label = "Çok Cazip";
  let color = "#10b981";
  if (finalScore >= 75) { label = "Çok Pahalı"; color = "#ef4444"; }
  else if (finalScore >= 55) { label = "Pahalı"; color = "#f97316"; }
  else if (finalScore >= 35) { label = "Makul"; color = "#eab308"; }
  else if (finalScore >= 18) { label = "Cazip"; color = "var(--up)"; }

  return { score: finalScore, label, color, details, dataCount };
}

export function ValuationScore({ ticker }: ValuationScoreProps) {
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.ratios(ticker),
      api.quote(ticker).catch(() => null),
    ]).then(([r, q]) => {
      setRatios(r);
      setQuote(q);
    }).catch(console.error).finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5 animate-pulse h-[200px]" />
    );
  }

  if (!ratios) return null;

  const { score, label, color, details, dataCount } = computeScore(ratios, quote);

  if (score === null) {
    return (
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl p-6 text-center">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mb-1">Pahalılık Skoru</p>
        <p style={{ color: "var(--text-muted)" }} className="text-[12px]">Bu hisse için değerleme verisi yetersiz.</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
      {/* Header */}
      <div
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">Pahalılık Skoru</p>
          <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
            {dataCount} metrik
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1 }} className="tabular-nums">{score}</p>
            <p style={{ color }} className="text-[12px] font-medium mt-0.5">{label}</p>
          </div>
          {details.length > 0 && (
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}
              className="hover:border-[var(--border-strong)] transition-all shrink-0"
            >
              {showDetails ? "Gizle" : "Detay"}
            </button>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 py-4">
        <div className="relative h-3 rounded-full overflow-hidden mb-1" style={{ background: "var(--bg-tertiary)" }}>
          <div className="absolute inset-0 rounded-full" style={{
            background: "linear-gradient(to right, var(--up), #eab308, #f97316, #ef4444)"
          }} />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md rounded-full transition-all"
            style={{ left: `${score}%`, transform: "translateX(-50%)" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {["Cazip", "Makul", "Pahalı", "Çok Pahalı"].map((l) => (
            <span key={l} style={{ color: "var(--text-muted)" }} className="text-[10px]">{l}</span>
          ))}
        </div>
      </div>

      {/* Detail rows */}
      {showDetails && details.length > 0 && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold py-2">Metrik Detayı</p>
          <div className="space-y-1.5">
            {details.map((d) => {
              const isExpensive = d.contribution > 5;
              const isCheap = d.contribution < -5;
              return (
                <div key={d.label} className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--text-secondary)" }} className="text-[12px]">{d.label}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums">{d.value}</span>
                    {d.note && (
                      <span
                        style={{
                          color: isCheap ? "var(--up)" : isExpensive ? "var(--down)" : "var(--text-muted)",
                          fontSize: 10, fontWeight: 500,
                        }}
                      >
                        {d.note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
