"use client";

import { useEffect, useState } from "react";
import { api, type DCFResult } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/formatters";

interface Props {
  ticker: string;
}

export function IntrinsicValueCard({ ticker }: Props) {
  const [growth, setGrowth] = useState(0.10);      // %10
  const [terminal, setTerminal] = useState(0.025); // %2.5
  const [discount, setDiscount] = useState(0.10);  // %10
  const [data, setData] = useState<DCFResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api.dcf(ticker, growth, terminal, discount)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 250); // debounce slider değişimleri
    return () => clearTimeout(handle);
  }, [ticker, growth, terminal, discount]);

  if (loading && !data) {
    return <Skeleton height="320px" />;
  }

  if (!data) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-muted)" }} className="text-[13px] text-center py-6">
          DCF hesaplanamadı.
        </p>
      </Card>
    );
  }

  if (data.error || !data.fairValuePerShare) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mb-1">DCF — Adil Değer</p>
        <p style={{ color: "var(--text-muted)" }} className="text-[12px]">{data.error || "Yetersiz veri."}</p>
      </Card>
    );
  }

  const upside = data.upsidePct ?? 0;
  const upsideUp = upside >= 0;
  const upsideTone: "up" | "down" | "warn" = upside > 20 ? "up" : upside < -10 ? "down" : "warn";

  return (
    <Card variant="elevated" padding="lg" className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">DCF Adil Değer</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-[11px] mt-0.5">Serbest nakit akışına dayalı içsel değer hesabı</p>
        </div>
        <Badge tone={upsideTone} size="md">
          {upsideUp ? "+" : ""}{upside.toFixed(1)}% {upsideUp ? "iskonto" : "prim"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">Mevcut Fiyat</p>
          <p style={{ color: "var(--text-primary)" }} className="text-[20px] font-bold tabular-nums">
            {formatPrice(data.currentPrice, data.currency)}
          </p>
        </div>
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wide">Adil Değer</p>
          <p style={{ color: upsideUp ? "var(--up)" : "var(--down)" }} className="text-[20px] font-bold tabular-nums">
            {formatPrice(data.fairValuePerShare, data.currency)}
          </p>
        </div>
      </div>

      {/* Visual bar */}
      <div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
          {data.currentPrice && data.fairValuePerShare && (() => {
            const max = Math.max(data.currentPrice, data.fairValuePerShare) * 1.1;
            const cpPct = (data.currentPrice / max) * 100;
            const fvPct = (data.fairValuePerShare / max) * 100;
            return (
              <>
                <div
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{
                    background: upsideUp
                      ? "linear-gradient(90deg, var(--text-muted), var(--up))"
                      : "linear-gradient(90deg, var(--down), var(--text-muted))",
                    width: `${Math.max(cpPct, fvPct)}%`,
                    opacity: 0.4,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
                  style={{ left: `${cpPct}%` }}
                  title="Mevcut Fiyat"
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{ background: upsideUp ? "var(--up)" : "var(--down)", left: `${fvPct}%` }}
                  title="Adil Değer"
                />
              </>
            );
          })()}
        </div>
        <div className="flex justify-between mt-1">
          <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">0</span>
          <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">Mevcut: Beyaz | Adil: Renkli</span>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <SliderRow
          label="Yıllık Büyüme (5Y)"
          value={growth}
          onChange={setGrowth}
          min={-0.10} max={0.30} step={0.01}
          format={(v) => `%${(v * 100).toFixed(1)}`}
          accent
        />
        <SliderRow
          label="Terminal Büyüme"
          value={terminal}
          onChange={setTerminal}
          min={0} max={0.05} step={0.005}
          format={(v) => `%${(v * 100).toFixed(1)}`}
        />
        <SliderRow
          label="İskonto Oranı (WACC)"
          value={discount}
          onChange={setDiscount}
          min={0.05} max={0.20} step={0.005}
          format={(v) => `%${(v * 100).toFixed(1)}`}
        />
      </div>

      <p style={{ color: "var(--text-muted)" }} className="text-[10px] leading-relaxed">
        Slider'larla varsayımları değiştirin. Hesaplama: 5 yıllık projected FCF + Gordon terminal value, WACC ile bugüne iskonto.
        Sonuç yatırım tavsiyesi değildir.
      </p>
    </Card>
  );
}

function SliderRow({
  label, value, onChange, min, max, step, format, accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
  format: (v: number) => string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: "var(--text-secondary)" }} className="text-[11.5px] font-medium">{label}</span>
        <span style={{ color: accent ? "var(--accent-primary)" : "var(--text-primary)" }} className="text-[12px] font-semibold tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          accentColor: "var(--accent-primary)",
          width: "100%",
          cursor: "pointer",
        }}
      />
    </div>
  );
}
