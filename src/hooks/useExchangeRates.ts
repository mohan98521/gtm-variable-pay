import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExchangeRate {
  id: string;
  currency_code: string;
  month_year: string;
  rate_to_usd: number;
  created_at: string;
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("month_year", { ascending: false });

      if (error) throw error;
      return data as ExchangeRate[];
    },
  });
}

export function useLatestExchangeRate(currencyCode: string | undefined) {
  return useQuery({
    queryKey: ["exchange_rate_latest", currencyCode],
    queryFn: async () => {
      if (!currencyCode || currencyCode === "USD") {
        return { rate_to_usd: 1, currency_code: "USD" };
      }

      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("currency_code", currencyCode)
        .order("month_year", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Return 1 if no exchange rate found (default to USD)
      return data ?? { rate_to_usd: 1, currency_code: currencyCode };
    },
    enabled: !!currencyCode,
  });
}

// Get exchange rate for a specific month
export function useExchangeRateByMonth(currencyCode: string | undefined, monthYear: string | undefined) {
  return useQuery({
    queryKey: ["exchange_rate", currencyCode, monthYear],
    queryFn: async () => {
      if (!currencyCode || currencyCode === "USD") {
        return { rate_to_usd: 1, currency_code: "USD" };
      }

      if (!monthYear) {
        // Use latest if no month specified
        const { data, error } = await supabase
          .from("exchange_rates")
          .select("*")
          .eq("currency_code", currencyCode)
          .order("month_year", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data ?? { rate_to_usd: 1, currency_code: currencyCode };
      }

      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("currency_code", currencyCode)
        .eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)
        .maybeSingle();

      if (error) throw error;
      return data ?? { rate_to_usd: 1, currency_code: currencyCode };
    },
    enabled: !!currencyCode,
  });
}
