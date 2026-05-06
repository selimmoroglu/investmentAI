const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export type Market = "BIST" | "US";

export interface StockRow {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume?: number | null;
}

export interface Quote {
  ticker: string;
  name: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  pe: number | null;
  forwardPE: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  summary: string | null;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialStatement {
  columns: string[];
  rows: { label: string; values: (number | null)[] }[];
}

export interface Technicals {
  sma20: { time: number; value: number }[];
  sma50: { time: number; value: number }[];
  sma200: { time: number; value: number }[];
  ema12: { time: number; value: number }[];
  ema26: { time: number; value: number }[];
  macd: { time: number; value: number }[];
  macdSignal: { time: number; value: number }[];
  macdHistogram: { time: number; value: number }[];
  rsi: { time: number; value: number }[];
  bbUpper: { time: number; value: number }[];
  bbMid: { time: number; value: number }[];
  bbLower: { time: number; value: number }[];
}

export interface SectorItem {
  sector: string;
  count: number;
  tickers: string[];
}

export const api = {
  stocks: (market: Market) => get<StockRow[]>(`/api/stocks?market=${market}`),
  quote: (ticker: string) => get<Quote>(`/api/quote/${ticker}`),
  history: (ticker: string, period = "6mo", interval = "1d") =>
    get<OHLCVBar[]>(`/api/history/${ticker}?period=${period}&interval=${interval}`),
  financials: (ticker: string, statement: string, freq: string) =>
    get<FinancialStatement>(`/api/financials/${ticker}?statement=${statement}&freq=${freq}`),
  technicals: (ticker: string) => get<Technicals>(`/api/technicals/${ticker}`),
  sectors: (market: Market) => get<SectorItem[]>(`/api/sectors?market=${market}`),
};
