"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import { LEGENDS, type Legend } from "@/lib/legends";
import { api, type LegendMatch, type Market } from "@/lib/api";
import { formatChange, formatRatio, formatPercent, formatMarketCap, changeClass } from "@/lib/formatters";

export default function LegendsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [selected, setSelected] = useState<Legend>(LEGENDS[0]);
  const [market, setMarket] = useState<Market>("BIST");
  const [matches, setMatches] = useState<LegendMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setMatches([]);
    api.legendMatches(selected.id, market, 25)
      .then((d) => setMatches(d.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected, market]);

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }} className="flex flex-col">
      {/* Header */}
      <header style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }} className="sticky top-0 z-50 h-14 flex items-center px-5 gap-4">
        <Link href="/" style={{ color: "var(--text-muted)" }} className="flex items-center gap-2 text-[13px] hover:text-[var(--text-primary)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          InvestmentAI
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{ color: "var(--text-primary)" }} className="text-[13px] font-medium">Yatırım Üstadları</span>

        <div className="ml-auto flex items-center gap-2">
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
          <button onClick={toggle} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer">
            {theme === "dark" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Intro */}
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-[28px] font-bold tracking-tight">Yatırım Üstadları</h1>
          <p style={{ color: "var(--text-muted)" }} className="text-[13px] mt-2 max-w-2xl leading-relaxed">
            Tarihin en başarılı yatırımcılarının felsefelerini, hisse seçim kriterlerini ve aktif filtrelerini keşfet.
            Her stratejiye uyan {market === "BIST" ? "BIST" : "ABD"} hisseleri gerçek zamanlı olarak listeleniyor.
          </p>
        </div>

        {/* Legend cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {LEGENDS.map((l) => {
            const active = selected.id === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                style={{
                  background: active ? "var(--bg-secondary)" : "var(--bg-card)",
                  borderColor: active ? l.accent : "var(--border)",
                  borderWidth: active ? 2 : 1,
                  borderStyle: "solid",
                }}
                className="rounded-xl p-3 text-left cursor-pointer hover:border-[var(--text-muted)] transition-all"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold mb-2"
                  style={{ background: l.accent + "20", color: l.accent }}>
                  {l.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold leading-tight">{l.name}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-0.5">{l.era}</p>
                <p style={{ color: l.accent }} className="text-[10px] mt-1 font-medium">{l.nickname}</p>
              </button>
            );
          })}
        </div>

        {/* Selected legend detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Profile + philosophy */}
          <div className="space-y-4">
            <div style={{ background: "var(--bg-secondary)", border: `1px solid ${selected.accent}40` }} className="rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold shrink-0"
                  style={{ background: selected.accent + "25", color: selected.accent }}>
                  {selected.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 style={{ color: "var(--text-primary)" }} className="text-[20px] font-bold">{selected.name}</h2>
                  <p style={{ color: selected.accent }} className="text-[12px] font-semibold mt-0.5">{selected.nickname} · {selected.era}</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-[13px] mt-3 leading-relaxed italic">
                    "{selected.philosophy}"
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--text-muted)" }} className="text-[12px] leading-relaxed mt-4 pt-4" >
                <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: 12 }}>{selected.bio}</span>
              </p>
            </div>

            {/* Approach */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider mb-3 font-semibold">Yatırım Yaklaşımı</p>
              <ol className="space-y-2.5">
                {selected.approach.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span style={{ background: selected.accent + "20", color: selected.accent }} className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12.5px] leading-relaxed">{item}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Quotes */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider mb-3 font-semibold">Ünlü Sözleri</p>
              <div className="space-y-3">
                {selected.quotes.map((q, i) => (
                  <p key={i} style={{ color: "var(--text-secondary)", borderLeft: `3px solid ${selected.accent}`, paddingLeft: 12 }} className="text-[12.5px] italic leading-relaxed">
                    "{q}"
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Criteria + avoid */}
          <div className="space-y-4">
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider mb-3 font-semibold">Hisse Seçim Kriterleri</p>
              <ul className="space-y-2">
                {selected.criteria.map((c, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "var(--up)", marginTop: 2, flexShrink: 0 }}>
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] leading-relaxed">{c.label}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider mb-3 font-semibold">Kaçındıkları</p>
              <ul className="space-y-2">
                {selected.avoid.map((c, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "var(--down)", marginTop: 2, flexShrink: 0 }}>
                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] leading-relaxed">{c}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Matches table */}
        <div>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 style={{ color: "var(--text-primary)" }} className="text-[18px] font-semibold">
                {selected.name}'in Filtrelerine Uyan Hisseler
              </h3>
              <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-1">
                {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"} • Skora göre sıralı • İlk 25
              </p>
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden">
            <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
              className="grid grid-cols-[60px_1.4fr_90px_90px_80px_80px_80px_80px_70px] px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider">
              <span>Skor</span>
              <span>Şirket</span>
              <span className="text-right">Fiyat</span>
              <span className="text-right">Değişim</span>
              <span className="text-right">F/K</span>
              <span className="text-right">PD/DD</span>
              <span className="text-right">ROE</span>
              <span className="text-right">Net Marj</span>
              <span className="text-right">Borç/Öz</span>
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                  className="h-[52px] animate-pulse" />
              ))
            ) : matches.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <p className="text-[13px]">Bu stratejinin filtrelerine uyan hisse bulunamadı.</p>
                <p className="text-[11px] mt-1">{market === "BIST" ? "ABD" : "BIST"} pazarına geçmeyi deneyin.</p>
              </div>
            ) : (
              matches.map((m, i) => {
                const isUp = (m.changePercent ?? 0) >= 0;
                return (
                  <div
                    key={m.ticker}
                    onClick={() => router.push(`/stock/${m.ticker}`)}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                    className="grid grid-cols-[60px_1.4fr_90px_90px_80px_80px_80px_80px_70px] px-4 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors items-center"
                  >
                    <div>
                      <span style={{ background: selected.accent + "25", color: selected.accent }} className="px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums">
                        {m.score.toFixed(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">{m.ticker.replace(".IS", "")}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px] truncate">{m.name}</p>
                    </div>
                    <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums text-right">
                      {m.currentPrice != null ? m.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </p>
                    <span
                      style={{ background: m.changePercent != null ? (isUp ? "var(--up-bg)" : "var(--down-bg)") : "transparent", justifySelf: "end" }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium tabular-nums ${changeClass(m.changePercent)}`}
                    >
                      {formatChange(m.changePercent)}
                    </span>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">{formatRatio(m.pe, 1)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">{formatRatio(m.pb)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">{formatPercent(m.roe)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] tabular-nums text-right">{formatPercent(m.netMargin)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[11px] tabular-nums text-right">
                      {m.debtToEquity != null ? m.debtToEquity.toFixed(0) : "—"}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {!loading && matches.length > 0 && (
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] mt-3 leading-relaxed">
              <strong>Not:</strong> Bu liste yalnızca finansal oran filtrelerine dayanır. Gerçek bir yatırım kararı için işletme kalitesi, yönetim,
              sektörel dinamikler ve makro koşullar mutlaka değerlendirilmelidir. Hiçbir bölüm yatırım tavsiyesi değildir.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
