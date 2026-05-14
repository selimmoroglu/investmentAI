export interface PortfolioPosition {
  id: string;
  ticker: string;
  name: string;
  market: "BIST" | "US";
  lots: number;        // hisse adedi
  buyPrice: number;    // alış fiyatı (hisse başına)
  buyDate: string;     // YYYY-MM-DD
  currency: string;    // TRY | USD
  notes?: string;
}

const STORAGE_KEY = "portfolio_v1";

export function loadPortfolio(): PortfolioPosition[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePortfolio(positions: PortfolioPosition[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function addPosition(pos: Omit<PortfolioPosition, "id">): PortfolioPosition {
  const positions = loadPortfolio();
  const newPos: PortfolioPosition = { ...pos, id: crypto.randomUUID() };
  savePortfolio([...positions, newPos]);
  return newPos;
}

export function updatePosition(id: string, updates: Partial<Omit<PortfolioPosition, "id">>): void {
  const positions = loadPortfolio().map((p) => (p.id === id ? { ...p, ...updates } : p));
  savePortfolio(positions);
}

export function removePosition(id: string): void {
  savePortfolio(loadPortfolio().filter((p) => p.id !== id));
}
