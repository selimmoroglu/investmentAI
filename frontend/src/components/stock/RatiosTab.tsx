"use client";

import { useEffect, useState } from "react";
import { api, type Ratios } from "@/lib/api";
import { formatRatio, formatPercent } from "@/lib/formatters";

interface RatiosTabProps {
  ticker: string;
}

function RatioGroup({ title, items }: {
  title: string;
  items: { label: string; value: string; note?: string; highlight?: boolean }[];
}) {
  return (
    <div
      style={{ border: "1px solid var(--border)" }}
      className="rounded-xl overflow-hidden"
    >
      <div
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        className="px-5 py-3"
      >
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold">{title}</p>
      </div>
      <div style={{ background: "var(--bg-card)" }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <p style={{ color: "var(--text-secondary)" }} className="text-[13px]">{item.label}</p>
              {item.note && (
                <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{item.note}</p>
              )}
            </div>
            <p
              style={{ color: item.highlight ? "var(--text-primary)" : "var(--text-primary)" }}
              className="text-[14px] font-semibold tabular-nums"
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function colorize(val: number | null, goodHigh = true): string {
  if (val == null) return "var(--text-muted)";
  return "var(--text-primary)";
}

export function RatiosTab({ ticker }: RatiosTabProps) {
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.ratios(ticker)
      .then(setRatios)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            className="rounded-xl h-[200px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!ratios) {
    return (
      <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>Oran verisi alınamadı.</div>
    );
  }

  const fmt = (v: number | null, dec = 2) => formatRatio(v, dec);
  const fmtPct = (v: number | null) => v != null ? formatPercent(v) : "—";

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <RatioGroup
        title="Değerleme Çarpanları"
        items={[
          { label: "F/K (P/E) — Fiyat/Kazanç", value: fmt(ratios.pe), note: "Hissenin kazancına göre fiyatı" },
          { label: "İleri F/K (Forward P/E)", value: fmt(ratios.forwardPE), note: "Beklenen kazanca göre" },
          { label: "PD/DD (P/B) — Fiyat/Defter", value: fmt(ratios.pb), note: "Defter değerine göre piyasa fiyatı" },
          { label: "F/S (P/S) — Fiyat/Satış", value: fmt(ratios.ps), note: "Satış gelirlerine göre fiyat" },
          { label: "FD/FAVÖK (EV/EBITDA)", value: fmt(ratios.evEbitda), note: "Şirket değeri / FAVÖK" },
          { label: "FD/Gelir (EV/Revenue)", value: fmt(ratios.evRevenue) },
          { label: "PEG Oranı", value: fmt(ratios.peg), note: "F/K ÷ Büyüme — <1 cazip" },
        ]}
      />

      <RatioGroup
        title="Karlılık Oranları"
        items={[
          { label: "Brüt Kar Marjı", value: fmtPct(ratios.grossMargin), note: "Satış geliri − Satılan malın maliyeti" },
          { label: "Faaliyet Kar Marjı", value: fmtPct(ratios.operatingMargin), note: "Operasyonel verimlilik" },
          { label: "Net Kar Marjı", value: fmtPct(ratios.netMargin), note: "Satışların yüzdesi olarak net kar" },
          { label: "FAVÖK Marjı", value: fmtPct(ratios.ebitdaMargin), note: "Faiz/vergi/amortisman öncesi" },
        ]}
      />

      <RatioGroup
        title="Verimlilik & Getiri"
        items={[
          { label: "Özsermaye Karlılığı (ROE)", value: fmtPct(ratios.roe), note: "Hissedar sermayesinin getirisi" },
          { label: "Aktif Karlılığı (ROA)", value: fmtPct(ratios.roa), note: "Toplam varlıkların getirisi" },
        ]}
      />

      <RatioGroup
        title="Borç & Likidite"
        items={[
          { label: "Borç/Özsermaye (D/E)", value: fmt(ratios.debtToEquity), note: "Finansal kaldıraç göstergesi" },
          { label: "Cari Oran", value: fmt(ratios.currentRatio), note: "Dönen varlıklar ÷ Kısa vadeli borçlar" },
          { label: "Asit-Test (Quick Ratio)", value: fmt(ratios.quickRatio), note: "Stoksuz likidite ölçümü" },
        ]}
      />

      <RatioGroup
        title="Büyüme"
        items={[
          { label: "Gelir Büyümesi (Y/Y)", value: fmtPct(ratios.revenueGrowth), note: "Yıldan yıla gelir artışı" },
          { label: "Kazanç Büyümesi (Y/Y)", value: fmtPct(ratios.earningsGrowth), note: "Yıldan yıla kazanç artışı" },
          { label: "Çeyreklik Kazanç Büyümesi", value: fmtPct(ratios.earningsQuarterlyGrowth) },
        ]}
      />

      <RatioGroup
        title="Temettü & Diğer"
        items={[
          { label: "Temettü Getirisi", value: fmtPct(ratios.dividendYield) },
          { label: "Temettü/Hisse", value: ratios.dividendRate != null ? `${ratios.dividendRate.toFixed(2)}` : "—" },
          { label: "Dağıtım Oranı (Payout)", value: fmtPct(ratios.payoutRatio), note: "Kazancın ne kadarı temettü dağıtılıyor" },
          { label: "Beta (Piyasa Hassasiyeti)", value: fmt(ratios.beta), note: "1'den büyük = piyasadan daha oynak" },
          { label: "Kurumsal Sahiplik", value: fmtPct(ratios.heldPercentInstitutions) },
        ]}
      />
    </div>
  );
}
