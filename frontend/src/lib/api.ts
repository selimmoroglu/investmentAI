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
  // Analist konsensüsü
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  targetMedianPrice: number | null;
  numberOfAnalystOpinions: number | null;
  recommendationKey: string | null;
  recommendationMean: number | null;
  // Nakit & değer
  freeCashflow: number | null;
  operatingCashflow: number | null;
  ebitda: number | null;
  totalRevenue: number | null;
  enterpriseValue: number | null;
  sharesOutstanding: number | null;
  totalCash: number | null;
  totalDebt: number | null;
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

export interface RealReturnPeriod {
  label: string;
  nominal: number;
  inflation: number | null;
  real: number | null;
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
}

export interface RealReturn {
  ticker: string;
  periods: RealReturnPeriod[];
}

export interface PiotroskiCriterion {
  key: string;
  label: string;
  category: "profitability" | "leverage" | "efficiency";
  passed: boolean | null;
  skipped: boolean;
}

export interface PiotroskiScore {
  score: number;
  maxScore: number;
  totalCriteria: number;
  verdict: string;
  verdictColor: "up" | "warn" | "down" | "neutral";
  breakdown: PiotroskiCriterion[];
  isFinancial?: boolean;
}

export interface AltmanPart {
  key: string;
  label: string;
  value: number | null;
  coef: number;
  weighted: number | null;
}

export interface AltmanAlternativeMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  verdict: string;
  color: "up" | "warn" | "down" | "neutral";
}

export interface AltmanScore {
  score: number | null;
  zone: string;
  zoneColor: "up" | "warn" | "down" | "neutral";
  zoneDescription: string;
  modelType?: "standard_z" | "not_applicable";
  notApplicableReason?: string;
  breakdown: AltmanPart[];
  alternativeMetrics?: AltmanAlternativeMetric[];
  capitalRatio?: number | null;
}

export interface QualityAnalysis {
  ticker: string;
  piotroski: PiotroskiScore | null;
  altman: AltmanScore | null;
  longTermVerdict: string;
  longTermColor: "up" | "warn" | "down" | "neutral";
  isFinancial?: boolean;
}

export interface DCFResult {
  currentPrice: number | null;
  fairValuePerShare: number | null;
  upsidePct: number | null;
  currency?: string | null;
  error?: string;
  valuationMethod?: "fcf_dcf" | "earnings_dcf";
  methodNote?: string;
  isFinancial?: boolean;
  inputs?: {
    growth5y: number;
    terminalGrowth: number;
    discountRate: number;
    startingFcf: number;
    sharesOutstanding: number;
    netDebt: number;
  };
  yearly?: { year: number; fcf: number; pv: number }[];
  terminalValuePresent?: number;
  enterpriseValue?: number;
  equityValue?: number;
  sensitivity?: { growthDelta: number; values: { discountDelta: number; fairValue: number | null; upsidePct: number | null }[] }[];
}

export interface CompositeBreakdown {
  quality: number;
  value: number;
  growth: number;
  yield: number;
}

export interface CompositeScore {
  ticker: string;
  score: number;
  verdict: "Çok Cazip" | "Cazip" | "Tut" | "Pahalı" | "Kaçın";
  verdictColor: "up" | "warn" | "down";
  breakdown: CompositeBreakdown;
  weights: { quality: number; value: number; growth: number; yield: number };
  isFinancial?: boolean;
}

export interface PortfolioPositionAnalysis {
  ticker: string;
  sector: string;
  compositeScore: number | null;
  compositeVerdict: string;
  verdictColor: "up" | "warn" | "down" | "neutral";
  breakdown: CompositeBreakdown | null;
  isFinancial: boolean;
  weight: number;
}

export interface PortfolioAnalysis {
  portfolioScore: number;
  portfolioVerdict: string;
  portfolioVerdictColor: "up" | "warn" | "down";
  portfolioBreakdown: CompositeBreakdown;
  concentrationHHI: number;
  concentrationLabel: string;
  concentrationColor: "up" | "warn" | "down";
  diversificationScore: number;
  topPositionWeight: number;
  sectorBreakdown: Record<string, number>;
  sectorCount: number;
  positions: PortfolioPositionAnalysis[];
  tickerCount: number;
}

export interface PeerRow {
  ticker: string;
  name: string;
  isOwn: boolean;
  currentPrice: number | null;
  changePercent: number | null;
  currency: string | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  fcfYield: number | null;
}

export interface PeerComparison {
  ticker: string;
  sector: string;
  market: Market;
  peers: PeerRow[];
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

export interface PortfolioPerfItem {
  currentPrice: number;
  prevClose: number | null;
  weekAgoPrice: number | null;
  monthAgoPrice: number | null;
  yearAgoPrice: number | null;
  changePercent1d: number | null;
  changePercent1w: number | null;
  changePercent1m: number | null;
  changePercent1y: number | null;
  currency: string;
  name: string;
}

export type PortfolioPerf = Record<string, PortfolioPerfItem>;

export interface PortfolioQuote {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: number | null;
  market: "BIST" | "US";
  sector: string;
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
  realReturn: (ticker: string) => get<RealReturn>(`/api/inflation/tr/real-return/${encodeURIComponent(ticker)}`),
  quality: (ticker: string) => get<QualityAnalysis>(`/api/quality/${encodeURIComponent(ticker)}`),
  dcf: (ticker: string, growth = 0.10, terminal = 0.025, discount = 0.10) =>
    get<DCFResult>(`/api/dcf/${encodeURIComponent(ticker)}?growth_5y=${growth}&terminal_growth=${terminal}&discount_rate=${discount}`),
  composite: (ticker: string) => get<CompositeScore>(`/api/composite/${encodeURIComponent(ticker)}`),
  peers: (ticker: string, limit = 5) => get<PeerComparison>(`/api/peers/${encodeURIComponent(ticker)}?limit=${limit}`),
  portfolioPerf: (tickers: string[]) => get<PortfolioPerf>(`/api/portfolio/perf?tickers=${tickers.map(encodeURIComponent).join(",")}`),
  portfolioQuote: (ticker: string) => get<PortfolioQuote>(`/api/portfolio/quote/${encodeURIComponent(ticker)}`),
  portfolioAnalysis: (tickers: string[], weights: number[]) =>
    get<PortfolioAnalysis>(`/api/portfolio/analysis?tickers=${tickers.map(encodeURIComponent).join(",")}&weights=${weights.join(",")}`),
};
