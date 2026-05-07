export function formatPrice(value: number | null, currency?: string | null): string {
  if (value == null) return "—";
  const formatted = value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "TRY") return `₺${formatted}`;
  if (currency === "USD") return `$${formatted}`;
  return formatted;
}

export function formatChange(value: number | null): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatMarketCap(value: number | null, currency?: string | null): string {
  if (value == null) return "—";
  if (currency === "TRY") {
    // TR: tam Türkçe büyüklük etiketleri
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)} Trilyon ₺`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Milyar ₺`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Milyon ₺`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Bin ₺`;
    return `${value.toFixed(0)} ₺`;
  }
  // USD veya diğer: kısa formatta kalsın
  const symbol = "$";
  if (value >= 1_000_000_000_000) return `${symbol}${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `${symbol}${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
  return `${symbol}${value.toFixed(0)}`;
}

export function formatBigNumber(value: number | null, currency?: string | null): string {
  if (value == null) return "—";
  if (currency === "TRY") {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)} Trilyon ₺`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Milyar ₺`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Milyon ₺`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Bin ₺`;
    return `${value.toFixed(0)} ₺`;
  }
  const symbol = currency === "USD" ? "$" : "";
  if (value >= 1_000_000_000_000) return `${symbol}${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `${symbol}${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

export function formatRatio(value: number | null, decimals = 2): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

export function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function changeClass(value: number | null): string {
  if (value == null) return "text-[var(--text-muted)]";
  return value >= 0 ? "text-[var(--up)]" : "text-[var(--down)]";
}

export function changeBgClass(value: number | null): string {
  if (value == null) return "";
  return value >= 0 ? "bg-[var(--up-bg)]" : "bg-[var(--down-bg)]";
}
