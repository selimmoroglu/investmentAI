"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Quote } from "@/lib/api";
import { StockTabs } from "@/components/stock/StockTabs";
import { SummaryTab } from "@/components/stock/SummaryTab";
import { FinancialsTab } from "@/components/stock/FinancialsTab";
import { TechnicalTab } from "@/components/stock/TechnicalTab";
import { formatPrice, formatChange, changeClass } from "@/lib/formatters";
import { useTheme } from "@/components/layout/ThemeProvider";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default function StockPage({ params }: PageProps) {
  const { ticker } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const { theme, toggle } = useTheme();

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
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
        }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center gap-4">
          {/* Back + Logo */}
          <Link
            href="/"
            style={{ color: "var(--text-muted)" }}
            className="flex items-center gap-2 text-[13px] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">InvestmentAI</span>
          </Link>

          <span style={{ color: "var(--border)" }} className="text-lg hidden sm:inline">/</span>

          {/* Stock info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span
              style={{ color: "var(--text-primary)" }}
              className="text-[15px] font-semibold"
            >
              {displayTicker}
            </span>
            {quote?.name && (
              <span style={{ color: "var(--text-muted)" }} className="text-[13px] truncate hidden sm:inline">
                {quote.name}
              </span>
            )}
          </div>

          {/* Price */}
          {quote && (
            <div className="flex items-center gap-3 shrink-0">
              <span
                style={{ color: "var(--text-primary)" }}
                className="text-[16px] font-semibold tabular-nums"
              >
                {formatPrice(quote.currentPrice, quote.currency)}
              </span>
              <span className={`text-[13px] font-medium tabular-nums ${changeClass(quote.changePercent)}`}>
                {formatChange(quote.changePercent)}
              </span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:text-[var(--text-primary)] cursor-pointer shrink-0"
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
      </header>

      {/* Content with tabs */}
      <div className="flex-1 flex flex-col max-w-[1400px] w-full mx-auto">
        <StockTabs ticker={ticker}>
          {(activeTab) => (
            <>
              {activeTab === "summary" && <SummaryTab ticker={ticker} />}
              {activeTab === "financials" && <FinancialsTab ticker={ticker} />}
              {activeTab === "technical" && <TechnicalTab ticker={ticker} />}
            </>
          )}
        </StockTabs>
      </div>
    </div>
  );
}
