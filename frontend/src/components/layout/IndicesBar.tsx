"use client";

import { useEffect, useState } from "react";
import { api, type IndexQuote } from "@/lib/api";
import { formatChange } from "@/lib/formatters";
import { Badge, Skeleton } from "@/components/ui";

function formatIndexPrice(price: number | null, ticker: string): string {
  if (price == null) return "—";
  // Crypto/index/fx: locale formatlama
  const dec = ticker === "BTC-USD" ? 0 : ticker.endsWith("=X") ? 4 : 2;
  return price.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function IndicesBar() {
  const [data, setData] = useState<IndexQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.indices()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      api.indices().then((d) => { if (!cancelled) setData(d); }).catch(() => {});
    }, 120_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading && data.length === 0) {
    return (
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }} className="flex gap-5 px-5 py-2.5 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width="120px" height="36px" />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
      className="flex gap-5 px-5 py-2.5 overflow-x-auto scrollbar-thin"
    >
      {data.map((item) => {
        const isUp = (item.changePercent ?? 0) >= 0;
        return (
          <div
            key={item.ticker}
            className="flex items-center gap-2 shrink-0 py-0.5"
            title={`${item.label} • ${item.ticker}`}
          >
            <div className="flex flex-col gap-0.5">
              <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-medium">
                {item.label}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span style={{ color: "var(--text-primary)" }} className="text-[12.5px] font-semibold tabular-nums">
                  {formatIndexPrice(item.price, item.ticker)}
                </span>
                <Badge tone={item.changePercent == null ? "neutral" : isUp ? "up" : "down"} size="sm">
                  {formatChange(item.changePercent)}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
