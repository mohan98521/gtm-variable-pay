import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ExchangeRate {
  id: string;
  currency_code: string;
  rate_to_usd: number;
  month_year: string;
  created_at: string;
}

export interface ExchangeRateInsert {
  currency_code: string;
  rate_to_usd: number;
  month_year: string;
}

export function useExchangeRates(monthYear?: string) {
  return useQuery({
    queryKey: ["exchange_rates", monthYear],
    queryFn: async () => {
      let query = supabase
        .from("exchange_rates")
        .select("*")
        .order("currency_code", { ascending: true });

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExchangeRate[];
    },
  });
}

export function useInsertExchangeRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rates: ExchangeRateInsert[]) => {
      // Upsert based on currency and month
      const { data, error } = await supabase
        .from("exchange_rates")
        .upsert(rates, { 
          onConflict: "currency_code,month_year",
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast({
        title: "Success",
        description: "Exchange rates saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
