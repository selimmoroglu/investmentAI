"use client";

import { useEffect, useState } from "react";
import { api, type DCFResult } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/formatters";
import { Info } from "lucide-react";

interface Props {
  ticker: string;
}

function isTurkishTicker(ticker: string) {
  return ticker.toUpperCase().endsWith(".IS");
}

// Türk hisseleri için gerçekçi DCF varsayımları:
// - Risksiz oran (~18-20% TCMB politika faizi + ERP)
// - Yüksek nominal büyüme (enflasyon dahil)
// - Terminal büyüme ≈ uzun vadeli TÜFE hedefi
const TR_DEFAULTS = { growth: 0.15, terminal: 0.08, discount: 0.20 };
const US_DEFAULTS = { growth: 0.10, terminal: 0.025, discount: 0.10 };

export function IntrinsicValueCard({ ticker }: Props) {
  const isTR = isTurkishTicker(ticker);
  const defaults = isTR ? TR_DEFAULTS : US_DEFAULTS;

  const [growth, setGrowth] = useState(defaults.growth);
  const [terminal, setTerminal] = useState(defaults.terminal);
  const [discount, setDiscount] = useState(defaults.discount);
  const [data, setData] = useState<DCFResult | null>(null);
  const [loading, setLoading] = useState(true);

  // ticker değişince default'lara sıfırla
  useEffect(() => {
    const d = isTurkishTicker(ticker) ? TR_DEFAULTS : US_DEFAULTS;
    setGrowth(d.growth);
    setTerminal(d.terminal);
    setDiscount(d.discount);
  }, [ticker]);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api.dcf(ticker, growth, terminal, discount)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [ticker, growth, terminal, discount]);

  if (loading && !data) return <Skeleton height="360px" />;

  if (!data) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-muted)" }} className="text-[13px] text-center py-6">DCF hesaplanamadı.</p>
      </Card>
    );
  }

  if (data.error || !data.fairValuePerShare) {
    return (
      <Card padding="lg">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold mb-2">DCF — Adil Değer</p>
        {data.isFinancial && (
          <div
            className="flex items-start gap-2 rounded-lg p-2.5 mb-2"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
          >
            <Info size={12} strokeWidth={2} color="var(--text-muted)" className="mt-0.5 shrink-0" />
            <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] leading-relaxed">
              Finansal şirket — FCF tabanlı DCF yerine net kâr tabanlı tahmin uygulandı.
            </p>
          </div>
        )}
        <p style={{ color: "var(--text-muted)" }} className="text-[12px]">{data.error || "Yetersiz veri."}</p>
      </Card>
    );
  }

  const upside = data.upsidePct ?? 0;
  const upsideUp = upside >= 0;
  const upsideTone: "up" | "down" | "warn" = upside > 20 ? "up" : upside < -10 ? "down" : "warn";

  const methodLabel = data.valuationMethod === "earnings_dcf" ? "Net Kâr Tabanlı DCF" : "FCF Tabanlı DCF";

  return (
    <Card variant="elevated" padding="lg" className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-wider font-semibold">DCF Adil Değer</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-[11px] mt-0.5">
            {methodLabel}
            {isTR && <span style={{ color: "var(--accent-primary)" }}> · TL varsayımları</span>}
          </p>
        </div>
        <Badge tone={upsideTone} size="md">
          {upsideUp ? "+" : ""}{upside.toFixed(1)}% {upsideUp ? "iskonto" : "prim"}
        </Badge>
      </div>

      {/* Finansal şirket notu */}
      {data.isFinancial && (
        <div
          className="flex items-start gap-2 rounded-lg p-2.5"
          style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
        >
          <Info size={12} strokeWidth={2} color="var(--accent-primary)" className="mt-0.5 shrink-0" />
          <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] leading-relaxed">
            Finansal şirket: FCF yerine net kâr × 0.65 kullanıldı (dağıtılabilir kâr tahmini).
            WACC değerini şirketin risk profiline göre ayarlayın.
          </p>
        </div>
      )}

      {/* Türk hissesi notu */}
      {isTR && !data.isFinancial && (
        <div
          className="flex items-start gap-2 rounded-lg p-2.5"
          style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <Info size={12} strokeWidth={2} color="var(--accent-primary)" className="mt-0.5 shrink-0" />
          <p style={{ color: "var(--text-muted)" }} className="text-[10.5px] leading-relaxed">
            TL bazlı hisse: %20 WACC (Türkiye risk primi + enflasyon), %15 büyüme ve %8 terminal büyüme varsayılanı.
            Kendi beklentinize göre ayarlayın.
          </p>
        </div>
      )}

      {/* Fiyatlar */}
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
                    opacity: 0.35,
                  }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md" style={{ left: `${cpPct}%` }} title="Mevcut Fiyat" />
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
          <span style={{ color: "var(--text-muted)" }} className="text-[9.5px]">Beyaz = Mevcut · Renkli = Adil Değer</span>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <SliderRow
          label="Yıllık Büyüme (5Y)"
          value={growth}
          onChange={setGrowth}
          min={isTR ? -0.10 : -0.10}
          max={isTR ? 0.40 : 0.30}
          step={0.01}
          format={(v) => `%${(v * 100).toFixed(1)}`}
          accent
        />
        <SliderRow
          label="Terminal Büyüme"
          value={terminal}
          onChange={setTerminal}
          min={0}
          max={isTR ? 0.15 : 0.05}
          step={0.005}
          format={(v) => `%${(v * 100).toFixed(1)}`}
        />
        <SliderRow
          label="İskonto Oranı (WACC)"
          value={discount}
          onChange={setDiscount}
          min={isTR ? 0.10 : 0.05}
          max={isTR ? 0.35 : 0.20}
          step={0.005}
          format={(v) => `%${(v * 100).toFixed(1)}`}
        />
      </div>

      <p style={{ color: "var(--text-muted)" }} className="text-[10px] leading-relaxed">
        {data.methodNote || "5 yıllık projected FCF + Gordon terminal value, WACC ile bugüne iskonto."}
        {" "}Sonuç yatırım tavsiyesi değildir.
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
        style={{ accentColor: "var(--accent-primary)", width: "100%", cursor: "pointer" }}
      />
    </div>
  );
}
