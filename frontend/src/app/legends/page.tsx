"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import { LEGENDS, type Legend } from "@/lib/legends";
import { api, type LegendMatch, type Market } from "@/lib/api";
import { formatChange, formatRatio, formatPercent, changeClass } from "@/lib/formatters";
import { trSector } from "@/lib/sectorTr";

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
    api.legendMatches(selected.id, market, 30)
      .then((d) => setMatches(d.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected, market]);

  // Sektör dağılımı
  const sectorDist = useMemo(() => {
    if (!matches.length) return [] as { sector: string; count: number; pct: number }[];
    const map = new Map<string, number>();
    matches.forEach((m) => {
      const s = m.sector || "Diğer";
      map.set(s, (map.get(s) || 0) + 1);
    });
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 6).map(([sector, count]) => ({
      sector,
      count,
      pct: (count / matches.length) * 100,
    }));
  }, [matches]);

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

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-6">
        {/* Hero — selected legend banner */}
        <div
          style={{
            background: `linear-gradient(135deg, ${selected.accent}25 0%, ${selected.accent2}15 50%, var(--bg-card) 100%)`,
            border: `1px solid ${selected.accent}40`,
            borderRadius: 20,
            position: "relative",
            overflow: "hidden",
          }}
          className="p-6 md:p-8"
        >
          {/* Decorative blob */}
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              background: `radial-gradient(circle, ${selected.accent}30 0%, transparent 70%)`,
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />

          <div className="relative flex flex-col md:flex-row gap-6 md:items-center">
            {/* Avatar */}
            <div
              style={{
                background: `linear-gradient(135deg, ${selected.accent}, ${selected.accent2})`,
                color: "#fff",
                width: 96,
                height: 96,
                fontSize: 32,
                boxShadow: `0 8px 24px ${selected.accent}40`,
              }}
              className="rounded-2xl flex items-center justify-center font-bold shrink-0"
            >
              {selected.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span style={{ background: selected.accent + "30", color: selected.accent }} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">
                  {selected.nickname}
                </span>
                <span style={{ color: "var(--text-muted)" }} className="text-[12px]">{selected.era}</span>
              </div>
              <h2 style={{ color: "var(--text-primary)" }} className="text-[28px] md:text-[32px] font-bold tracking-tight leading-tight">
                {selected.name}
              </h2>
              <p style={{ color: "var(--text-secondary)" }} className="text-[14px] md:text-[15px] mt-2 italic leading-relaxed max-w-3xl">
                "{selected.philosophy}"
              </p>

              {/* Style chips */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {selected.style.map((s) => (
                  <span
                    key={s}
                    style={{
                      background: "var(--bg-secondary)",
                      border: `1px solid ${selected.accent}50`,
                      color: "var(--text-secondary)",
                    }}
                    className="px-2.5 py-1 rounded-full text-[10.5px] font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6 pt-6" style={{ borderTop: `1px solid ${selected.accent}30` }}>
            <HeroStat label="Yıllık Getiri" value={selected.stats.annualReturn} accent={selected.accent} highlight />
            <HeroStat label="Aktif Dönem" value={selected.stats.activeYears} accent={selected.accent} />
            <HeroStat label="Karşılaştırma" value={selected.stats.benchmark || "—"} accent={selected.accent} />
            <HeroStat label="Yönetilen Varlık" value={selected.stats.aum || "—"} accent={selected.accent} />
          </div>
        </div>

        {/* Legend selector grid */}
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold mb-3">Yatırımcı Seç</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {LEGENDS.map((l) => {
              const active = selected.id === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelected(l)}
                  style={{
                    background: active ? `linear-gradient(135deg, ${l.accent}20, transparent)` : "var(--bg-card)",
                    borderColor: active ? l.accent : "var(--border)",
                    borderWidth: active ? 2 : 1,
                    borderStyle: "solid",
                    boxShadow: active ? `0 4px 16px ${l.accent}30` : "none",
                  }}
                  className="rounded-xl p-2.5 text-left cursor-pointer hover:border-[var(--text-muted)] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${l.accent}, ${l.accent2})`,
                        color: "#fff",
                        width: 32, height: 32,
                        fontSize: 11,
                      }}
                      className="rounded-full flex items-center justify-center font-bold shrink-0"
                    >
                      {l.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-[11px] font-semibold leading-tight truncate">{l.name}</p>
                      <p style={{ color: l.accent }} className="text-[9px] mt-0.5 font-medium">{l.stats.annualReturn}/yıl</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Approach (large) */}
          <div className="lg:col-span-2 space-y-5">
            <SectionCard accent={selected.accent} icon="approach" title="Yatırım Yaklaşımı" subtitle={`${selected.name}'ın 6 prensibi`}>
              <ol className="space-y-3">
                {selected.approach.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${selected.accent}, ${selected.accent2})`,
                        color: "#fff",
                      }}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    >
                      {i + 1}
                    </div>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[13px] leading-relaxed pt-0.5">{item}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* Bio */}
            <SectionCard accent={selected.accent} icon="bio" title="Hakkında">
              <p style={{ color: "var(--text-secondary)" }} className="text-[13px] leading-relaxed">{selected.bio}</p>
            </SectionCard>

            {/* Quotes */}
            <SectionCard accent={selected.accent} icon="quote" title="Ünlü Sözleri">
              <div className="space-y-3">
                {selected.quotes.map((q, i) => (
                  <div key={i} className="relative pl-5">
                    <span
                      style={{
                        position: "absolute", left: 0, top: -4,
                        color: selected.accent, fontSize: 28, fontFamily: "Georgia, serif", lineHeight: 1,
                      }}
                    >"</span>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[13px] italic leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Sidebar — criteria + avoid */}
          <div className="space-y-5">
            <SectionCard accent={selected.accent} icon="check" title="Aradıkları" subtitle="Hisse seçim kriterleri">
              <ul className="space-y-2.5">
                {selected.criteria.map((c, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <div
                      style={{ background: "var(--up-bg)", color: "var(--up)" }}
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] leading-relaxed">{c.label}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard accent={selected.accent} icon="x" title="Kaçındıkları" subtitle="Bu özelliklere sahip hisseleri eler">
              <ul className="space-y-2.5">
                {selected.avoid.map((c, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <div
                      style={{ background: "var(--down-bg)", color: "var(--down)" }}
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p style={{ color: "var(--text-secondary)" }} className="text-[12px] leading-relaxed">{c}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* Sektör dağılımı */}
            {sectorDist.length > 0 && (
              <SectionCard accent={selected.accent} icon="chart" title="Eşleşen Hisselerin Sektörleri" subtitle={`${matches.length} hisse arasından`}>
                <div className="space-y-2.5">
                  {sectorDist.map((s) => (
                    <div key={s.sector}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span style={{ color: "var(--text-secondary)" }} className="text-[11.5px]">{trSector(s.sector)}</span>
                        <span style={{ color: "var(--text-muted)" }} className="text-[10px] tabular-nums">{s.count}</span>
                      </div>
                      <div style={{ background: "var(--bg-tertiary)", height: 5 }} className="rounded-full overflow-hidden">
                        <div
                          style={{
                            background: `linear-gradient(90deg, ${selected.accent}, ${selected.accent2})`,
                            width: `${s.pct}%`,
                            height: "100%",
                          }}
                          className="rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>

        {/* Matches table */}
        <div>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 style={{ color: "var(--text-primary)" }} className="text-[20px] font-semibold">
                {selected.name}'in Stratejisine Uyan Hisseler
              </h3>
              <p style={{ color: "var(--text-muted)" }} className="text-[12px] mt-1">
                {market === "BIST" ? "Borsa İstanbul" : "ABD Borsası"} • Skora göre sıralı • İlk 30 hisse
              </p>
            </div>
            {!loading && matches.length > 0 && (
              <span
                style={{
                  background: `linear-gradient(135deg, ${selected.accent}30, ${selected.accent2}20)`,
                  color: selected.accent,
                  border: `1px solid ${selected.accent}50`,
                }}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold"
              >
                {matches.length} eşleşme
              </span>
            )}
          </div>

          <div style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }} className="rounded-xl overflow-hidden">
            <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
              className="grid grid-cols-[60px_1.4fr_90px_90px_70px_70px_80px_80px_70px] px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider">
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
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                  className="h-[52px] animate-pulse" />
              ))
            ) : matches.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 opacity-30">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>Bu stratejinin filtrelerine uyan hisse bulunamadı.</p>
                <p className="text-[11px]">{market === "BIST" ? "ABD" : "BIST"} pazarına geçmeyi deneyin.</p>
              </div>
            ) : (
              matches.map((m, i) => {
                const isUp = (m.changePercent ?? 0) >= 0;
                return (
                  <div
                    key={m.ticker}
                    onClick={() => router.push(`/stock/${m.ticker}`)}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)" }}
                    className="grid grid-cols-[60px_1.4fr_90px_90px_70px_70px_80px_80px_70px] px-4 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors items-center"
                  >
                    <span
                      style={{
                        background: `linear-gradient(135deg, ${selected.accent}30, ${selected.accent2}20)`,
                        color: selected.accent,
                        border: `1px solid ${selected.accent}50`,
                      }}
                      className="px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums w-fit"
                    >
                      {m.score.toFixed(0)}
                    </span>
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

function HeroStat({ label, value, accent, highlight }: { label: string; value: string; accent: string; highlight?: boolean }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide font-medium mb-1">{label}</p>
      <p
        style={{ color: highlight ? accent : "var(--text-primary)" }}
        className="text-[15px] md:text-[17px] font-bold tabular-nums leading-tight"
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title, subtitle, children, icon, accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon: "approach" | "bio" | "quote" | "check" | "x" | "chart";
  accent: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    approach: <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>,
    bio: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>,
    quote: <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c.5 0 .75 .25.75.75v.5c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>,
    check: <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    x: <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>,
    chart: <path d="M3 3v18h18M7 14l4-4 4 3 5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>,
  };
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} className="rounded-xl p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div style={{ background: accent + "20", color: accent }} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">{icons[icon]}</svg>
        </div>
        <div>
          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold leading-tight">{title}</p>
          {subtitle && <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
