"use client";

import { useRouter } from "next/navigation";
import { type StockRow } from "@/lib/api";
import { formatChange, formatVolume, changeClass } from "@/lib/formatters";

interface StockTableProps {
  stocks: StockRow[];
  loading?: boolean;
}

const COLUMNS = [
  { key: "ticker", label: "Sembol", width: "w-[110px]" },
  { key: "name", label: "Şirket", width: "flex-1" },
  { key: "sector", label: "Sektör", width: "w-[160px]" },
  { key: "currentPrice", label: "Fiyat", width: "w-[110px]", align: "right" },
  { key: "changePercent", label: "Değişim", width: "w-[100px]", align: "right" },
  { key: "volume", label: "Hacim", width: "w-[100px]", align: "right" },
];

function SkeletonRow() {
  return (
    <div className="flex items-center px-4 py-3 gap-4 border-b border-[var(--border)]">
      {[110, 200, 140, 90, 80, 80].map((w, i) => (
        <div
          key={i}
          style={{ width: w, background: "var(--bg-tertiary)" }}
          className="h-4 rounded animate-pulse"
        />
      ))}
    </div>
  );
}

export function StockTable({ stocks, loading }: StockTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <div className="text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p>Sonuç bulunamadı</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          color: "var(--text-muted)",
        }}
        className="flex items-center px-4 py-2 gap-4 text-[11px] font-medium uppercase tracking-wider sticky top-0"
      >
        <span className="w-[110px]">Sembol</span>
        <span className="flex-1">Şirket</span>
        <span className="w-[160px] hidden md:block">Sektör</span>
        <span className="w-[110px] text-right">Fiyat</span>
        <span className="w-[100px] text-right">Değişim</span>
        <span className="w-[100px] text-right hidden sm:block">Hacim</span>
      </div>

      {/* Rows */}
      {stocks.map((stock) => {
        const isUp = (stock.changePercent ?? 0) >= 0;
        const priceStr = stock.currentPrice != null
          ? stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "—";

        return (
          <div
            key={stock.ticker}
            onClick={() => router.push(`/stock/${stock.ticker}`)}
            style={{ borderBottom: "1px solid var(--border)" }}
            className="flex items-center px-4 py-3 gap-4 cursor-pointer transition-colors hover:bg-[var(--bg-secondary)] group"
          >
            <span
              className="w-[110px] text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {stock.ticker.replace(".IS", "")}
            </span>

            <span
              className="flex-1 text-[13px] truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {stock.name}
            </span>

            <span
              className="w-[160px] text-[12px] hidden md:block truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {stock.sector}
            </span>

            <span
              className="w-[110px] text-right text-[13px] font-medium tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {priceStr}
            </span>

            <span
              className={`w-[100px] text-right text-[12px] font-medium tabular-nums ${changeClass(stock.changePercent)}`}
            >
              <span
                style={{
                  background: stock.changePercent != null
                    ? isUp ? "var(--up-bg)" : "var(--down-bg)"
                    : "transparent",
                }}
                className="inline-block px-2 py-0.5 rounded text-[11px]"
              >
                {formatChange(stock.changePercent)}
              </span>
            </span>

            <span
              className="w-[100px] text-right text-[12px] hidden sm:block tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {formatVolume(stock.volume ?? null)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
