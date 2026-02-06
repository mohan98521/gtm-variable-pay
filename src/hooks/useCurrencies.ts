/**
 * Centralized Currency Hook
 * 
 * Single source of truth for all currency data in the system.
 * Fetches from the `currencies` table and provides helpers.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
}

export function useCurrencies() {
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as Currency[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build lookup maps
  const symbolMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  currencies.forEach((c) => {
    symbolMap.set(c.code, c.symbol);
    nameMap.set(c.code, c.name);
  });

  const getCurrencySymbol = (code: string): string => {
    const symbol = symbolMap.get(code);
    return symbol && symbol.trim() ? symbol : `${code} `;
  };

  const getCurrencyName = (code: string): string => {
    return nameMap.get(code) || code;
  };

  // Options formatted for SearchableSelect and Select components
  const currencyOptions = currencies.map((c) => ({
    value: c.code,
    label: `${c.code} - ${c.name}`,
  }));

  // Simple code-only options (for simpler selects)
  const currencyCodeOptions = currencies.map((c) => ({
    value: c.code,
    label: c.code,
  }));

  return {
    currencies,
    isLoading,
    currencyOptions,
    currencyCodeOptions,
    getCurrencySymbol,
    getCurrencyName,
  };
}

/**
 * Hook for managing currencies (admin CRUD)
 */
export function useCurrencyManagement() {
  const queryClient = useQueryClient();

  const { data: allCurrencies = [], isLoading } = useQuery({
    queryKey: ["currencies_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as Currency[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (currency: { code: string; name: string; symbol?: string }) => {
      const code = currency.code.toUpperCase().trim();
      const { error } = await supabase.from("currencies").insert({
        code,
        name: currency.name.trim(),
        symbol: currency.symbol?.trim() || code,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["currencies_all"] });
      toast.success("Currency added successfully");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("This currency code already exists");
      } else {
        toast.error(`Failed to add currency: ${error.message}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; symbol: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("currencies")
        .update({ name: data.name.trim(), symbol: data.symbol.trim(), is_active: data.is_active })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["currencies_all"] });
      toast.success("Currency updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update currency: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("currencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["currencies_all"] });
      toast.success("Currency deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete currency: ${error.message}`);
    },
  });

  return {
    allCurrencies,
    isLoading,
    createCurrency: createMutation.mutate,
    updateCurrency: updateMutation.mutate,
    deleteCurrency: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
