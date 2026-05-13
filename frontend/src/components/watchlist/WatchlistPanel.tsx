"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Quote } from "@/lib/api";
import { useWatchlist } from "@/lib/watchlist";
import { formatChange } from "@/lib/formatters";
import { Badge, Skeleton } from "@/components/ui";

interface Row {
  ticker: string;
  name?: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
}

export function WatchlistPanel() {
  const router = useRouter();
  const { items, remove } = useWatchlist();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(
      items.map((it) =>
        api.quote(it.ticker)
          .then((q: Quote) => ({
            ticker: it.ticker,
            name: it.name || q.name || it.ticker,
            price: q.currentPrice,
            changePercent: q.changePercent,
            currency: q.currency,
          }))
          .catch(() => ({
            ticker: it.ticker,
            name: it.name,
            price: null,
            changePercent: null,
            currency: null,
          }))
      )
    ).then((data) => {
      if (!cancelled) setRows(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [items]);

  const fmtPrice = (v: number | null, cur: string | null) => {
    if (v == null) return "—";
    const sym = cur === "TRY" ? "₺" : cur === "USD" ? "$" : "";
    return `${sym}${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <aside
      style={{
        background: "var(--glass-bg)",
        borderLeft: "1px solid var(--glass-border)",
        width: 280,
        minWidth: 280,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      className="hidden lg:flex flex-col overflow-hidden"
    >
      <div style={{ borderBottom: "1px solid var(--glass-border)" }} className="px-4 py-3 flex items-center justify-between">
        <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">
          Takip Listem
        </p>
        {items.length > 0 && <Badge tone="accent" size="sm">{items.length}</Badge>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 opacity-40">
              <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.62L12 2L9.19 8.62L2 9.24L7.46 13.97L5.82 21L12 17.27Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <p className="text-[12px] mb-1" style={{ color: "var(--text-secondary)" }}>Liste boş</p>
            <p className="text-[11px]">Hisse detay sayfasındaki yıldıza tıklayarak ekleyin</p>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="px-2 py-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height="52px" />
            ))}
          </div>
        ) : (
          rows.map((r) => {
            const isUp = (r.changePercent ?? 0) >= 0;
            return (
              <div
                key={r.ticker}
                style={{ borderBottom: "1px solid var(--border)" }}
                className="px-3 py-2.5 flex items-center gap-2 group hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <button
                  onClick={() => router.push(`/stock/${r.ticker}`)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-semibold truncate">
                      {r.ticker.replace(".IS", "")}
                    </p>
                    <p style={{ color: "var(--text-primary)" }} className="text-[12px] font-medium tabular-nums shrink-0">
                      {fmtPrice(r.price, r.currency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p style={{ color: "var(--text-muted)" }} className="text-[10px] truncate">
                      {r.name}
                    </p>
                    <Badge tone={r.changePercent == null ? "neutral" : isUp ? "up" : "down"} size="sm">
                      {formatChange(r.changePercent)}
                    </Badge>
                  </div>
                </button>
                <button
                  onClick={() => remove(r.ticker)}
                  title="Listeden çıkar"
                  style={{ color: "var(--text-muted)" }}
                  className="opacity-0 group-hover:opacity-100 hover:text-[var(--down)] transition-all cursor-pointer shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
