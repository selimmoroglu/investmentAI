"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Quote } from "@/lib/api";
import { SummaryTab } from "@/components/stock/SummaryTab";
import { FinancialsTab } from "@/components/stock/FinancialsTab";
import { TechnicalTab } from "@/components/stock/TechnicalTab";
import { RatiosTab } from "@/components/stock/RatiosTab";
import { formatPrice, formatChange, changeClass } from "@/lib/formatters";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useWatchlist } from "@/lib/watchlist";
import { ArrowLeft, Sun, Moon, Star } from "lucide-react";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

type NavSection =
  | "summary"
  | "financials"
  | "ratios"
  | "technical";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
}

const ChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M7 16l4-5 4 3 4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const TableIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 9h18M3 15h18M9 3v18" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);
const RatioIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const TechIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M2 12h4l3-6 4 12 3-6 3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SummaryIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: "summary", label: "Özet Rapor", icon: <SummaryIcon /> },
  { id: "financials", label: "Finansal Tablolar", icon: <TableIcon /> },
  { id: "ratios", label: "Finansal Oranlar", icon: <RatioIcon /> },
  { id: "technical", label: "Teknik Analiz", icon: <TechIcon /> },
];

export default function StockPage({ params }: PageProps) {
  const { ticker } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [active, setActive] = useState<NavSection>("summary");
  const { theme, toggle } = useTheme();
  const { has: isInWatchlist, toggle: toggleWatch } = useWatchlist();
  const inWatchlist = isInWatchlist(ticker);

  useEffect(() => {
    api.quote(ticker).then(setQuote).catch(console.error);
  }, [ticker]);

  const displayTicker = ticker.replace(".IS", "");

  return (
    <div
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}
      className="flex flex-col"
    >
      {/* Top bar */}
      <header
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        className="sticky top-0 z-50"
      >
        <div className="h-14 px-6 flex items-center gap-4">
          <Link
            href="/"
            style={{ color: "var(--text-muted)" }}
            className="flex items-center gap-2 text-[13px] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            <span className="hidden sm:inline">InvestmentAI</span>
          </Link>

          <span style={{ color: "var(--border)" }}>/</span>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span style={{ color: "var(--text-primary)" }} className="text-[15px] font-bold tracking-tight">
              {displayTicker}
            </span>
            {quote?.name && (
              <span style={{ color: "var(--text-muted)" }} className="text-[13px] truncate hidden sm:inline">
                {quote.name}
              </span>
            )}
            {quote?.exchange && (
              <span
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0 hidden sm:inline"
              >
                {quote.exchange}
              </span>
            )}
          </div>

          {/* Price */}
          {quote && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p style={{ color: "var(--text-primary)" }} className="text-[17px] font-bold tabular-nums">
                  {formatPrice(quote.currentPrice, quote.currency)}
                </p>
                <p className={`text-[12px] font-medium tabular-nums ${changeClass(quote.changePercent)}`}>
                  {formatChange(quote.changePercent)}
                  {quote.change != null && ` (${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)})`}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => toggleWatch({ ticker, name: quote?.name || undefined })}
            title={inWatchlist ? "Takipten çıkar" : "Takibe ekle"}
            style={{
              background: inWatchlist ? "var(--up-bg)" : "var(--bg-secondary)",
              border: `1px solid ${inWatchlist ? "var(--up)" : "var(--border)"}`,
              color: inWatchlist ? "var(--up)" : "var(--text-secondary)",
            }}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg cursor-pointer shrink-0 text-[12px] font-medium hover:text-[var(--text-primary)] transition-all"
          >
            <Star size={13} strokeWidth={1.8} fill={inWatchlist ? "currentColor" : "none"} />
            <span className="hidden sm:inline">{inWatchlist ? "Takipte" : "Takibe Al"}</span>
          </button>

          <button
            onClick={toggle}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer shrink-0 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside
          style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)", width: 220, minWidth: 220 }}
          className="hidden md:flex flex-col py-3 overflow-y-auto sticky top-14 h-[calc(100vh-56px)]"
        >
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.id} item={item} active={active} onClick={setActive} />
          ))}
        </aside>

        {/* Mobile nav */}
        <div
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
          className="md:hidden flex overflow-x-auto gap-1 px-4 py-2 shrink-0"
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              style={{
                background: active === item.id ? "var(--bg-tertiary)" : "transparent",
                color: active === item.id ? "var(--text-primary)" : "var(--text-muted)",
                border: active === item.id ? "1px solid var(--border)" : "1px solid transparent",
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap cursor-pointer transition-all"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {active === "summary" && <SummaryTab ticker={ticker} />}
          {active === "financials" && <FinancialsTab ticker={ticker} />}
          {active === "ratios" && <RatiosTab ticker={ticker} />}
          {active === "technical" && <TechnicalTab ticker={ticker} />}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: NavSection;
  onClick: (id: NavSection) => void;
}) {
  const isActive = active === item.id;
  return (
    <button
      onClick={() => onClick(item.id)}
      style={{
        background: isActive ? "var(--bg-secondary)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        borderLeft: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
      }}
      className="w-full flex items-center gap-3 py-2.5 px-4 text-[13px] font-medium transition-all cursor-pointer hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
    >
      <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}
