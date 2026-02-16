import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SalesFunction {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// Helper to bypass generated types for the new table
const sf = () => (supabase as any).from("sales_functions");

export function useSalesFunctions(includeInactive = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["sales-functions", includeInactive],
    queryFn: async () => {
      let q = sf().select("*").order("display_order", { ascending: true });
      if (!includeInactive) {
        q = q.eq("is_active", true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as SalesFunction[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["sales-functions"] });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await sf()
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.display_order ?? 0) + 1;
      const { error } = await sf().insert({ name, display_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sales function added"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await sf().update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sales function updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sf().update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sf().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sales function deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        sf().update({ display_order: idx + 1 }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    salesFunctions: query.data ?? [],
    isLoading: query.isLoading,
    addSalesFunction: addMutation.mutateAsync,
    updateSalesFunction: updateMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    deleteSalesFunction: deleteMutation.mutateAsync,
    reorder: reorderMutation.mutateAsync,
  };
}
