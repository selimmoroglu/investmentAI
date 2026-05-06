"use client";

import { useState } from "react";

type Tab = "summary" | "financials" | "technical";

interface StockTabsProps {
  ticker: string;
  children: (activeTab: Tab) => React.ReactNode;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Özet" },
  { id: "financials", label: "Finansal Tablolar" },
  { id: "technical", label: "Teknik Analiz" },
];

export function StockTabs({ ticker, children }: StockTabsProps) {
  const [active, setActive] = useState<Tab>("summary");

  return (
    <div className="flex flex-col flex-1">
      <div
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
        className="flex gap-0 px-6"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              color: active === tab.id ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: active === tab.id ? "2px solid var(--text-primary)" : "2px solid transparent",
            }}
            className="px-4 py-3 text-[13px] font-medium transition-all cursor-pointer -mb-px"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {children(active)}
      </div>
    </div>
  );
}
