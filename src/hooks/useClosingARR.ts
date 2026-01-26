import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Constants
export const ORDER_CATEGORY_2_OPTIONS = [
  { value: "software", label: "Software" },
  { value: "managed_service", label: "Managed Service" },
] as const;

// Types
export interface ClosingARRActual {
  id: string;
  month_year: string;
  bu: string;
  product: string;
  pid: string;
  customer_code: string;
  customer_name: string;
  order_category: string | null;
  status: string | null;
  order_category_2: string | null;
  opening_arr: number | null;
  cr: number | null;
  als_others: number | null;
  new: number | null;
  inflation: number | null;
  discount_decrement: number | null;
  churn: number | null;
  adjustment: number | null;
  closing_arr: number | null;
  country: string | null;
  revised_region: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_status: string | null;
  sales_rep_employee_id: string | null;
  sales_rep_name: string | null;
  sales_head_employee_id: string | null;
  sales_head_name: string | null;
  created_at: string;
  updated_at: string;
}

export type ClosingARRInsert = Omit<ClosingARRActual, "id" | "closing_arr" | "created_at" | "updated_at">;
export type ClosingARRUpdate = Partial<ClosingARRInsert>;

// Fetch all records for a month
export function useClosingARRData(monthYear?: string) {
  return useQuery({
    queryKey: ["closing-arr-actuals", monthYear],
    queryFn: async () => {
      let query = supabase
        .from("closing_arr_actuals")
        .select("*")
        .order("pid", { ascending: true });

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching closing ARR data:", error);
        throw error;
      }

      return data as ClosingARRActual[];
    },
    enabled: !!monthYear,
  });
}

// Create new record
export function useCreateClosingARR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: ClosingARRInsert) => {
      const { data, error } = await supabase
        .from("closing_arr_actuals")
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error("Error creating closing ARR record:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["closing-arr-actuals"] });
      toast.success("Closing ARR record created successfully");
    },
    onError: (error: Error) => {
      if (error.message.includes("closing_arr_actuals_month_pid_unique")) {
        toast.error("A record with this PID already exists for the selected month");
      } else {
        toast.error(`Failed to create record: ${error.message}`);
      }
    },
  });
}

// Update existing record
export function useUpdateClosingARR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ClosingARRUpdate }) => {
      const { data, error } = await supabase
        .from("closing_arr_actuals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating closing ARR record:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-arr-actuals"] });
      toast.success("Closing ARR record updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update record: ${error.message}`);
    },
  });
}

// Delete record
export function useDeleteClosingARR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("closing_arr_actuals")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting closing ARR record:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-arr-actuals"] });
      toast.success("Closing ARR record deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete record: ${error.message}`);
    },
  });
}

// Bulk upsert for CSV upload
export function useBulkUpsertClosingARR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (records: ClosingARRInsert[]) => {
      // Use upsert with onConflict to handle duplicates
      const { data, error } = await supabase
        .from("closing_arr_actuals")
        .upsert(records, {
          onConflict: "month_year,pid",
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        console.error("Error bulk upserting closing ARR records:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["closing-arr-actuals"] });
      toast.success(`Successfully uploaded ${data?.length || 0} records`);
    },
    onError: (error: Error) => {
      toast.error(`Bulk upload failed: ${error.message}`);
    },
  });
}

// Calculate summary statistics
export function calculateClosingARRSummary(
  records: ClosingARRActual[],
  fiscalYear: number
) {
  const fiscalYearEnd = new Date(fiscalYear, 11, 31); // Dec 31 of fiscal year

  const eligibleRecords = records.filter((r) => {
    if (!r.end_date) return false;
    return new Date(r.end_date) > fiscalYearEnd;
  });

  const totalOpeningARR = records.reduce((sum, r) => sum + (r.opening_arr || 0), 0);
  const totalClosingARR = records.reduce((sum, r) => sum + (r.closing_arr || 0), 0);
  const totalChanges = totalClosingARR - totalOpeningARR;

  const eligibleOpeningARR = eligibleRecords.reduce((sum, r) => sum + (r.opening_arr || 0), 0);
  const eligibleClosingARR = eligibleRecords.reduce((sum, r) => sum + (r.closing_arr || 0), 0);

  return {
    totalProjects: records.length,
    totalOpeningARR,
    totalChanges,
    totalClosingARR,
    eligibleProjects: eligibleRecords.length,
    eligibleOpeningARR,
    eligibleClosingARR,
  };
}
