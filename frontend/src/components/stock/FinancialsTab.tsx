"use client";

import { useEffect, useState } from "react";
import { api, type FinancialStatement } from "@/lib/api";

interface FinancialsTabProps {
  ticker: string;
  defaultStatement?: StatementType;
}

type StatementType = "income" | "balance" | "cashflow";
type Freq = "annual" | "quarterly";

const STATEMENTS: { id: StatementType; label: string }[] = [
  { id: "income", label: "Gelir Tablosu" },
  { id: "balance", label: "Bilanço" },
  { id: "cashflow", label: "Nakit Akışı" },
];

function formatStatValue(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// yfinance label → Türkçe çeviri tablosu (case-insensitive eşleme)
const TR_LABELS: Record<string, string> = {
  // Income statement
  "Total Revenue": "Toplam Hasılat",
  "Operating Revenue": "Faaliyet Geliri",
  "Cost Of Revenue": "Satışların Maliyeti",
  "Cost Of Goods Sold": "Satışların Maliyeti",
  "Gross Profit": "Brüt Kar",
  "Operating Expense": "Faaliyet Giderleri",
  "Operating Expenses": "Faaliyet Giderleri",
  "Selling General And Administration": "Satış, Genel ve Yönetim Giderleri",
  "Selling General Administrative": "Satış, Genel ve Yönetim Giderleri",
  "Research And Development": "Araştırma ve Geliştirme",
  "Operating Income": "Esas Faaliyet Karı",
  "Operating Income Loss": "Esas Faaliyet Kar/Zararı",
  "Total Operating Income As Reported": "Esas Faaliyet Karı",
  "Ebit": "FVÖK",
  "Ebitda": "FAVÖK",
  "Normalized Ebitda": "Normalleştirilmiş FAVÖK",
  "Interest Expense": "Faiz Giderleri",
  "Interest Income": "Faiz Geliri",
  "Net Interest Income": "Net Faiz Geliri",
  "Other Non Operating Income Expenses": "Diğer Faaliyet Dışı Gelir/Gider",
  "Pretax Income": "Vergi Öncesi Kar",
  "Tax Provision": "Vergi Karşılığı",
  "Tax Rate For Calcs": "Efektif Vergi Oranı",
  "Net Income": "Net Kar",
  "Net Income Common Stockholders": "Adi Hissedarlara Düşen Net Kar",
  "Net Income From Continuing Operation Net Minority Interest": "Sürdürülen Faaliyetlerden Net Kar",
  "Net Income From Continuing And Discontinued Operation": "Toplam Net Kar",
  "Net Income Including Noncontrolling Interests": "Net Kar (Azınlık Payı Dahil)",
  "Minority Interests": "Azınlık Payı",
  "Diluted Ni Availto Com Stockholders": "Sulandırılmış Net Kar",
  "Basic EPS": "Hisse Başı Kar (Temel)",
  "Diluted EPS": "Hisse Başı Kar (Sulandırılmış)",
  "Basic Average Shares": "Ortalama Adi Pay (Temel)",
  "Diluted Average Shares": "Ortalama Adi Pay (Sulandırılmış)",
  "Total Expenses": "Toplam Giderler",
  "Reconciled Cost Of Revenue": "Düzeltilmiş Satışların Maliyeti",
  "Reconciled Depreciation": "Düzeltilmiş Amortisman",
  "Depreciation Amortization Depletion": "Amortisman ve İtfa",
  "Depreciation And Amortization In Income Statement": "Amortisman (Gelir Tablosunda)",
  "Total Unusual Items": "Olağandışı Kalemler",
  "Total Unusual Items Excluding Goodwill": "Olağandışı Kalemler (Şerefiye Hariç)",
  "Net Non Operating Interest Income Expense": "Net Faaliyet Dışı Faiz",
  "Other Income Expense": "Diğer Gelir/Gider",

  // Balance sheet
  "Total Assets": "Toplam Varlıklar",
  "Current Assets": "Dönen Varlıklar",
  "Total Current Assets": "Toplam Dönen Varlıklar",
  "Cash And Cash Equivalents": "Nakit ve Nakit Benzerleri",
  "Cash Cash Equivalents And Short Term Investments": "Nakit ve Kısa Vadeli Yatırımlar",
  "Cash Financial": "Nakit",
  "Other Short Term Investments": "Diğer Kısa Vadeli Yatırımlar",
  "Receivables": "Alacaklar",
  "Accounts Receivable": "Ticari Alacaklar",
  "Inventory": "Stoklar",
  "Other Current Assets": "Diğer Dönen Varlıklar",
  "Non Current Assets": "Duran Varlıklar",
  "Total Non Current Assets": "Toplam Duran Varlıklar",
  "Net PPE": "Maddi Duran Varlıklar (Net)",
  "Gross PPE": "Maddi Duran Varlıklar (Brüt)",
  "Properties": "Maddi Duran Varlıklar",
  "Goodwill": "Şerefiye",
  "Goodwill And Other Intangible Assets": "Şerefiye ve Diğer Maddi Olmayan Varlıklar",
  "Other Intangible Assets": "Maddi Olmayan Varlıklar",
  "Investments And Advances": "Yatırımlar ve Avanslar",
  "Long Term Equity Investment": "Uzun Vadeli Özsermaye Yatırımları",
  "Other Non Current Assets": "Diğer Duran Varlıklar",
  "Total Liabilities Net Minority Interest": "Toplam Yükümlülükler",
  "Total Liabilities": "Toplam Yükümlülükler",
  "Current Liabilities": "Kısa Vadeli Yükümlülükler",
  "Total Current Liabilities": "Toplam Kısa Vadeli Yükümlülükler",
  "Accounts Payable": "Ticari Borçlar",
  "Payables And Accrued Expenses": "Borçlar ve Tahakkuk Eden Giderler",
  "Payables": "Borçlar",
  "Current Debt": "Kısa Vadeli Borç",
  "Current Debt And Capital Lease Obligation": "Kısa Vadeli Borç ve Kira Yükümlülüğü",
  "Other Current Liabilities": "Diğer Kısa Vadeli Yükümlülükler",
  "Non Current Liabilities Net Minority Interest": "Uzun Vadeli Yükümlülükler",
  "Total Non Current Liabilities Net Minority Interest": "Toplam Uzun Vadeli Yükümlülükler",
  "Long Term Debt": "Uzun Vadeli Borç",
  "Long Term Debt And Capital Lease Obligation": "Uzun Vadeli Borç ve Kira Yükümlülüğü",
  "Other Non Current Liabilities": "Diğer Uzun Vadeli Yükümlülükler",
  "Stockholders Equity": "Özsermaye",
  "Total Equity Gross Minority Interest": "Toplam Özsermaye (Azınlık Dahil)",
  "Common Stock Equity": "Adi Hisse Özsermayesi",
  "Common Stock": "Adi Hisse",
  "Retained Earnings": "Birikmiş Karlar",
  "Capital Stock": "Sermaye",
  "Additional Paid In Capital": "Sermaye Yedekleri",
  "Treasury Stock": "Hazine Hisseleri",
  "Gains Losses Not Affecting Retained Earnings": "Birikmiş Diğer Kapsamlı Gelir",
  "Minority Interest": "Azınlık Payı",
  "Total Debt": "Toplam Borç",
  "Net Debt": "Net Borç",
  "Tangible Book Value": "Maddi Defter Değeri",
  "Net Tangible Assets": "Net Maddi Varlıklar",
  "Working Capital": "İşletme Sermayesi",
  "Invested Capital": "Yatırılmış Sermaye",
  "Total Capitalization": "Toplam Kapitalizasyon",
  "Common Stock Shares Issued": "Çıkarılmış Adi Pay Sayısı",
  "Ordinary Shares Number": "Adi Pay Sayısı",
  "Share Issued": "Çıkarılmış Pay Sayısı",

  // Cash flow
  "Operating Cash Flow": "Faaliyet Nakit Akışı",
  "Cash Flow From Continuing Operating Activities": "Sürdürülen Faaliyetlerden Nakit Akışı",
  "Cash Flow From Operating Activities": "Faaliyet Nakit Akışı",
  "Investing Cash Flow": "Yatırım Nakit Akışı",
  "Cash Flow From Continuing Investing Activities": "Sürdürülen Yatırım Faaliyetleri Nakit Akışı",
  "Financing Cash Flow": "Finansman Nakit Akışı",
  "Cash Flow From Continuing Financing Activities": "Sürdürülen Finansman Faaliyetleri Nakit Akışı",
  "End Cash Position": "Dönem Sonu Nakit",
  "Beginning Cash Position": "Dönem Başı Nakit",
  "Changes In Cash": "Nakit Değişimi",
  "Capital Expenditure": "Sermaye Harcaması (CAPEX)",
  "Purchase Of PPE": "MDV Alımı",
  "Sale Of PPE": "MDV Satışı",
  "Free Cash Flow": "Serbest Nakit Akışı",
  "Net Income From Continuing Operations": "Sürdürülen Faaliyetlerden Net Kar",
  "Depreciation And Amortization": "Amortisman ve İtfa",
  "Stock Based Compensation": "Hisse Bazlı Ödemeler",
  "Change In Working Capital": "İşletme Sermayesi Değişimi",
  "Change In Receivables": "Alacaklarda Değişim",
  "Changes In Account Receivables": "Ticari Alacaklarda Değişim",
  "Change In Payable": "Borçlarda Değişim",
  "Change In Inventory": "Stoklarda Değişim",
  "Change In Other Working Capital": "Diğer İşletme Sermayesi Değişimi",
  "Other Non Cash Items": "Diğer Nakit Olmayan Kalemler",
  "Issuance Of Capital Stock": "Sermaye İhracı",
  "Repurchase Of Capital Stock": "Hisse Geri Alımı",
  "Cash Dividends Paid": "Ödenen Temettü",
  "Common Stock Dividend Paid": "Ödenen Adi Hisse Temettüsü",
  "Long Term Debt Issuance": "Uzun Vadeli Borç İhracı",
  "Long Term Debt Payments": "Uzun Vadeli Borç Ödemeleri",
  "Net Long Term Debt Issuance": "Net Uzun Vadeli Borç İhracı",
  "Net Short Term Debt Issuance": "Net Kısa Vadeli Borç İhracı",
  "Net Common Stock Issuance": "Net Adi Hisse İhracı",
  "Net Issuance Payments Of Debt": "Net Borç Ödemeleri",
  "Effect Of Exchange Rate Changes": "Kur Farkları Etkisi",
  "Net Investment Purchase And Sale": "Net Yatırım Alım/Satım",
  "Purchase Of Investment": "Yatırım Alımı",
  "Sale Of Investment": "Yatırım Satışı",
  "Net Business Purchase And Sale": "Net İşletme Alım/Satım",
  "Net Other Investing Changes": "Diğer Yatırım Değişimleri",
  "Net Other Financing Charges": "Diğer Finansman Değişimleri",
  "Income Tax Paid Supplemental Data": "Ödenen Vergi (Ek Bilgi)",
  "Interest Paid Supplemental Data": "Ödenen Faiz (Ek Bilgi)",
};

function trLabel(label: string): string {
  // 1) tam eşleşme
  if (TR_LABELS[label]) return TR_LABELS[label];
  // 2) case-insensitive eşleşme
  const lower = label.toLowerCase();
  for (const [k, v] of Object.entries(TR_LABELS)) {
    if (k.toLowerCase() === lower) return v;
  }
  // 3) çevrilmemiş etiketi olduğu gibi göster
  return label;
}

export function FinancialsTab({ ticker, defaultStatement = "income" }: FinancialsTabProps) {
  const [statement, setStatement] = useState<StatementType>(defaultStatement);
  const [freq, setFreq] = useState<Freq>("annual");
  const [data, setData] = useState<FinancialStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.financials(ticker, statement, freq)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker, statement, freq]);

  return (
    <div className="p-6 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex rounded-lg p-[3px] gap-[2px]"
        >
          {STATEMENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatement(s.id)}
              style={{
                background: statement === s.id ? "var(--bg-card)" : "transparent",
                color: statement === s.id ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: statement === s.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex rounded-lg p-[3px] gap-[2px]"
        >
          {(["annual", "quarterly"] as Freq[]).map((f) => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              style={{
                background: freq === f ? "var(--bg-card)" : "transparent",
                color: freq === f ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: freq === f ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
            >
              {f === "annual" ? "Yıllık" : "Çeyreklik"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="rounded-xl h-64 animate-pulse"
        />
      ) : !data || data.rows.length === 0 ? (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="rounded-xl p-8 text-center"
        >
          <p style={{ color: "var(--text-muted)" }} className="text-[13px]">
            Bu hisse için finansal tablo verisi bulunamadı.
          </p>
        </div>
      ) : (
        <div
          style={{ border: "1px solid var(--border)" }}
          className="rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th
                    style={{ color: "var(--text-muted)" }}
                    className="text-left px-4 py-3 font-medium w-[220px]"
                  >
                    Kalem
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      style={{ color: "var(--text-muted)" }}
                      className="text-right px-4 py-3 font-medium tabular-nums"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                    }}
                    className="hover:brightness-95 transition-all"
                  >
                    <td
                      style={{ color: "var(--text-secondary)" }}
                      className="px-4 py-2.5 font-medium"
                    >
                      {trLabel(row.label)}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        style={{ color: "var(--text-primary)" }}
                        className="px-4 py-2.5 text-right tabular-nums"
                      >
                        {formatStatValue(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
