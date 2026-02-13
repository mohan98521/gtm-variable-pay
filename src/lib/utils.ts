import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared currency formatting utility.
 * mode "abbreviated" → $1.2M, $45.5K, $800  (for cards/summaries)
 * mode "full"        → $1,200,000            (for tables/exports)
 * currencyCode + locale can be used for INR grouping (Lakhs/Crores).
 */
export function formatCurrencyValue(
  value: number,
  options?: {
    mode?: "abbreviated" | "full";
    currencyCode?: string;
    showSymbol?: boolean;
  }
): string {
  const { mode = "abbreviated", currencyCode = "USD", showSymbol = true } = options || {};
  const symbol = showSymbol ? "$" : "";

  if (mode === "abbreviated") {
    if (Math.abs(value) >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
    return `${symbol}${Math.round(value).toLocaleString()}`;
  }

  // Full precision mode
  if (currencyCode === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: showSymbol ? "currency" : "decimal",
      currency: showSymbol ? "INR" : undefined,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (showSymbol) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
