"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type PeerComparison } from "@/lib/api";
import { Card, Skeleton, Badge } from "@/components/ui";
import { formatRatio, formatPercent, formatMarketCap, formatChange } from "@/lib/formatters";
import { trSector } from "@/lib/sectorTr";

interface Props {
  ticker: string;
}

export function PeerComparisonCard({ ticker }: Props) {
  const router = useRouter();
  const [data, setData] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.peers(ticker, 5)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <Skeleton height="280px" />;
  if (!data || data.peers.length < 2) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-muted)" }} className="text-[13px] text-center py-6">
          Sektörde yeterli emsal hisse bulunamadı.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      <div
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
      >
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">Sektör Emsalleri</p>
          <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mt-0.5">
            {trSector(data.sector)} · {data.market}
          </p>
        </div>
        <Badge tone="accent" size="md">{data.peers.length - 1} emsal</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="text-left px-4 py-2 font-medium uppercase text-[10px] tracking-wider">Şirket</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Piy. Değ.</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">F/K</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">PD/DD</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">ROE</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Net Marj</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">FCF Ver.</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Temettü</th>
              <th className="text-right px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Değişim</th>
            </tr>
          </thead>
          <tbody>
            {data.peers.map((p, i) => {
              const isUp = (p.changePercent ?? 0) >= 0;
              return (
                <tr
                  key={p.ticker}
                  onClick={() => !p.isOwn && router.push(`/stock/${p.ticker}`)}
                  style={{
                    borderBottom: i < data.peers.length - 1 ? "1px solid var(--border)" : "none",
                    background: p.isOwn ? "var(--accent-muted)" : i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                    cursor: p.isOwn ? "default" : "pointer",
                  }}
                  className={p.isOwn ? "" : "hover:bg-[var(--bg-tertiary)] transition-colors"}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <p
                          style={{
                            color: p.isOwn ? "var(--accent-primary)" : "var(--text-primary)",
                            fontWeight: p.isOwn ? 700 : 600,
                          }}
                          className="text-[12.5px]"
                        >
                          {p.ticker.replace(".IS", "")}
                        </p>
                        <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] truncate max-w-[140px]">{p.name}</p>
                      </div>
                      {p.isOwn && <Badge tone="accent" size="sm">Bu hisse</Badge>}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {formatMarketCap(p.marketCap, p.currency)}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatRatio(p.pe, 1)}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatRatio(p.pb, 2)}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatPercent(p.roe)}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatPercent(p.netMargin)}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: p.fcfYield != null && p.fcfYield > 5 ? "var(--up)" : "var(--text-primary)" }}>
                    {p.fcfYield != null ? `${p.fcfYield.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatPercent(p.dividendYield)}
                  </td>
                  <td className="text-right px-3 py-2.5">
                    <Badge tone={p.changePercent == null ? "neutral" : isUp ? "up" : "down"} size="sm">
                      {formatChange(p.changePercent)}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] leading-relaxed">
          Aynı sektördeki şirketleri yan yana görerek hissenin sektör içindeki konumunu değerlendirin.
          F/K + PD/DD ortalamadan düşük + ROE ortalamadan yüksek = potansiyel cazip.
        </p>
      </div>
    </Card>
  );
}
