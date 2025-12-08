import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface MonthlyBooking {
  id: string;
  employee_id: string;
  month_year: string;
  booking_type: string;
  booking_value_usd: number;
  booking_value_local: number | null;
  local_currency: string | null;
  tcv_value_usd: number | null;
  deal_type: string | null;
  first_year_amc_arr_usd: number | null;
  deal_name: string | null;
  client_name: string | null;
  status: string;
  collection_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBookingInsert {
  employee_id: string;
  month_year: string;
  booking_type: string;
  booking_value_usd: number;
  booking_value_local?: number | null;
  local_currency?: string | null;
  tcv_value_usd?: number | null;
  deal_type?: string | null;
  first_year_amc_arr_usd?: number | null;
  deal_name?: string | null;
  client_name?: string | null;
  status?: string;
  collection_date?: string | null;
}

export function useMonthlyBookings(monthYear?: string) {
  return useQuery({
    queryKey: ["monthly_bookings", monthYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyBooking[];
    },
  });
}

export function useInsertMonthlyBookings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookings: MonthlyBookingInsert[]) => {
      const { data, error } = await supabase
        .from("monthly_bookings")
        .insert(bookings)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_bookings"] });
      toast({
        title: "Success",
        description: "Bookings uploaded successfully",
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

export function useUpdateMonthlyBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MonthlyBooking> & { id: string }) => {
      const { data, error } = await supabase
        .from("monthly_bookings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_bookings"] });
      toast({
        title: "Success",
        description: "Booking updated successfully",
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

export function useDeleteMonthlyBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("monthly_bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_bookings"] });
      toast({
        title: "Success",
        description: "Booking deleted successfully",
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
