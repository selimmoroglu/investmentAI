// US sector → Türkçe çeviri tablosu
const US_SECTOR_TR: Record<string, string> = {
  "Technology": "Teknoloji",
  "Information Technology": "Teknoloji",
  "Communication Services": "İletişim",
  "Consumer Discretionary": "Tüketici (İhtiyari)",
  "Consumer Staples": "Tüketici (Temel)",
  "Financials": "Finans",
  "Financial Services": "Finansal Hizmetler",
  "Healthcare": "Sağlık",
  "Health Care": "Sağlık",
  "Energy": "Enerji",
  "Industrials": "Sanayi",
  "Utilities": "Kamu Hizmetleri",
  "Real Estate": "Gayrimenkul",
  "Materials": "Malzemeler",
  "Basic Materials": "Temel Malzemeler",
  "ETF": "ETF",
};

export function trSector(sector: string): string {
  return US_SECTOR_TR[sector] ?? sector;
}
