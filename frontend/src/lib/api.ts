const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
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
  currency?: string | null;
  marketCap?: number | null;
  pe?: number | null;
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

export interface Ratios {
  pe: number | null;
  forwardPE: number | null;
  pb: number | null;
  ps: number | null;
  evEbitda: number | null;
  evRevenue: number | null;
  peg: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  ebitdaMargin: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  earningsQuarterlyGrowth: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  dividendRate: number | null;
  beta: number | null;
  shortRatio: number | null;
  heldPercentInstitutions: number | null;
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

export interface TechSummary {
  overall: "Pozitif" | "Negatif" | "Nötr" | null;
  rsi: number | null;
  rsiLabel: "Aşırı Alım" | "Aşırı Satım" | "Nötr" | null;
  macdSignal: "Pozitif" | "Negatif" | null;
  priceVsSMA50: number | null;
  priceVsSMA200: number | null;
  goldenCross: boolean;
}

export interface Technicals {
  currentPrice: number;
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
  support: number[];
  resistance: number[];
  trend: "Yükseliş" | "Düşüş" | "Yatay";
  trendSlopePct: number;
  channelMid: { time: number; value: number }[];
  channelUpper: { time: number; value: number }[];
  channelLower: { time: number; value: number }[];
  summary: TechSummary;
}

export interface SectorItem {
  sector: string;
  count: number;
  tickers: string[];
}

export interface SectorStocks {
  sector: string;
  stocks: StockRow[];
}

export interface SectorStats {
  sector: string;
  avgPE: number | null;
  medianPE: number | null;
  avgPB: number | null;
  avgEVEBITDA: number | null;
  avgPS: number | null;
  avgROE: number | null;
  avgNetMargin: number | null;
  avgDividendYield: number | null;
  avgChangePercent: number | null;
  stockCount: number;
  ratedCount: number;
}

export interface LegendMatch {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  currency: string | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  peg: number | null;
  dividendYield: number | null;
  score: number;
}

export interface LegendMatches {
  strategy: string;
  market: Market;
  matches: LegendMatch[];
}

export interface IndexQuote {
  ticker: string;
  label: string;
  group: "index" | "fx" | "commodity" | "crypto";
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
}

export interface IndexAnalysis {
  ticker: string;
  label: string;
  group: "index" | "fx" | "commodity" | "crypto";
  currentPrice: number;
  trend: "Yükseliş" | "Düşüş" | "Yatay";
  trendSlopePct: number;
  valuation: "Ucuz" | "Hafif Ucuz" | "Adil" | "Hafif Pahalı" | "Pahalı";
  valuationColor: "up" | "warn-good" | "neutral" | "warn" | "down";
  valuationNote: string;
  deviationFromMean5y: number;
  zScore1y: number;
  yearHigh: number;
  yearLow: number;
  yearMean: number;
  rangePosition1y: number;
  fiveYearHigh: number;
  fiveYearLow: number;
  fiveYearMean: number;
  rangePosition5y: number;
  movingAverages: { label: string; value: number; deviation: number; above: boolean }[];
  support: number[];
  resistance: number[];
  performance: Record<string, number | null>;
  history: { time: number; value: number }[];
}

export const api = {
  sectors: (market: Market) => get<SectorItem[]>(`/api/sectors?market=${market}`),
  sectorStocks: (sector: string, market: Market) =>
    get<SectorStocks>(`/api/sectors/${encodeURIComponent(sector)}/stocks?market=${market}`),
  sectorStats: (sector: string, market: Market) =>
    get<SectorStats>(`/api/sectors/${encodeURIComponent(sector)}/stats?market=${market}`),
  quote: (ticker: string) => get<Quote>(`/api/quote/${ticker}`),
  ratios: (ticker: string) => get<Ratios>(`/api/ratios/${ticker}`),
  history: (ticker: string, period = "6mo", interval = "1d") =>
    get<OHLCVBar[]>(`/api/history/${ticker}?period=${period}&interval=${interval}`),
  financials: (ticker: string, statement: string, freq: string) =>
    get<FinancialStatement>(`/api/financials/${ticker}?statement=${statement}&freq=${freq}`),
  technicals: (ticker: string) => get<Technicals>(`/api/technicals/${ticker}`),
  indices: () => get<IndexQuote[]>(`/api/indices`),
  indexAnalysis: (ticker: string) => get<IndexAnalysis>(`/api/indices/${encodeURIComponent(ticker)}/analysis`),
  legendMatches: (strategyId: string, market: Market, limit = 20) =>
    get<LegendMatches>(`/api/legends/${strategyId}/matches?market=${market}&limit=${limit}`),
};
