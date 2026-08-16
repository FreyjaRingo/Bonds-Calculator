const CURRENCY_SYMBOLS: Record<"IDR" | "USD", string> = { IDR: "Rp", USD: "$" };

/**
 * Currency amounts always use Indonesian-style separators (period for thousands,
 * comma for decimals) regardless of currency, matching how the source Excel
 * workbook displays them (e.g. "$ 100.000,00") -- only the symbol changes with
 * the bond's currency.
 */
export function formatCurrency(amount: number, currency: "IDR" | "USD"): string {
  const number = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${CURRENCY_SYMBOLS[currency]} ${number}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatPercent(value: number, digits = 4): string {
  const number = new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value * 100);
  return `${number}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** yyyy-MM-dd for <input type="date"> value/defaultValue. */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}
