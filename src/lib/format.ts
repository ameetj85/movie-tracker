import { CURRENCY } from "./constants";

const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

export function formatPrice(cents: number | null): string | null {
  return cents == null ? null : priceFormatter.format(cents / 100);
}

/** SQLite CURRENT_TIMESTAMP values are UTC "YYYY-MM-DD HH:MM:SS". */
export function formatTimestamp(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Plain YYYY-MM-DD date (no time zone shift). */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
