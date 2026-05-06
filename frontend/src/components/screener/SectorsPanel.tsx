"use client";

import { type SectorItem, type Market } from "@/lib/api";
import { useRouter } from "next/navigation";

interface SectorsPanelProps {
  sectors: SectorItem[];
  market: Market;
  onSectorClick?: (tickers: string[]) => void;
}

export function SectorsPanel({ sectors, market, onSectorClick }: SectorsPanelProps) {
  return (
    <aside
      style={{
        background: "var(--bg-card)",
        borderLeft: "1px solid var(--border)",
        width: 220,
        minWidth: 220,
      }}
      className="hidden lg:flex flex-col"
    >
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="px-4 py-3"
      >
        <span
          style={{ color: "var(--text-muted)" }}
          className="text-[11px] font-medium uppercase tracking-wider"
        >
          Sektörler — {market}
        </span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {sectors.map((item) => (
          <button
            key={item.sector}
            onClick={() => onSectorClick?.(item.tickers)}
            style={{ color: "var(--text-secondary)" }}
            className="w-full flex items-center justify-between px-4 py-2 text-left text-[13px] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <span className="truncate">{item.sector}</span>
            <span
              style={{ color: "var(--text-muted)" }}
              className="text-[11px] tabular-nums shrink-0 ml-2"
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
