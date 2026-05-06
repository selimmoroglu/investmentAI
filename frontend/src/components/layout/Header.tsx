"use client";

import { useTheme } from "./ThemeProvider";
import { type Market } from "@/lib/api";

interface HeaderProps {
  market: Market;
  onMarketChange: (m: Market) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export function Header({ market, onMarketChange, search, onSearchChange }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M2 18L8 10L13 14L20 4" stroke="var(--up)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="20" cy="4" r="2" fill="var(--up)"/>
          </svg>
          <span
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            className="text-[15px] font-semibold"
          >
            InvestmentAI
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" stroke="var(--text-muted)" strokeWidth="2"/>
            <path d="M16.5 16.5L21 21" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hisse ara... (THYAO, AAPL)"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            className="w-full pl-9 pr-4 py-[7px] rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-blue-500/40 placeholder:text-[var(--text-muted)] transition-all"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Market toggle */}
          <div
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            className="flex rounded-lg p-[3px] gap-[2px]"
          >
            {(["BIST", "US"] as Market[]).map((m) => (
              <button
                key={m}
                onClick={() => onMarketChange(m)}
                style={{
                  background: market === m ? "var(--bg-card)" : "transparent",
                  color: market === m ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: market === m ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                }}
                className="px-4 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
              >
                {m === "BIST" ? "🇹🇷 BIST" : "🇺🇸 ABD"}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
