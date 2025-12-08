import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface MonthlyPayout {
  id: string;
  employee_id: string;
  month_year: string;
  payout_type: string;
  calculated_amount_usd: number;
  paid_amount_usd: number | null;
  holdback_amount_usd: number | null;
  status: string;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyPayoutInsert {
  employee_id: string;
  month_year: string;
  payout_type: string;
  calculated_amount_usd: number;
  paid_amount_usd?: number | null;
  holdback_amount_usd?: number | null;
  status?: string;
  paid_date?: string | null;
  notes?: string | null;
}

export function useMonthlyPayouts(monthYear?: string) {
  return useQuery({
    queryKey: ["monthly_payouts", monthYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_payouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyPayout[];
    },
  });
}

export function useInsertMonthlyPayouts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payouts: MonthlyPayoutInsert[]) => {
      const { data, error } = await supabase
        .from("monthly_payouts")
        .insert(payouts)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_payouts"] });
      toast({
        title: "Success",
        description: "Payouts recorded successfully",
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

export function useUpdateMonthlyPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MonthlyPayout> & { id: string }) => {
      const { data, error } = await supabase
        .from("monthly_payouts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_payouts"] });
      toast({
        title: "Success",
        description: "Payout updated successfully",
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
