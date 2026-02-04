import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export interface DealCollection {
  id: string;
  deal_id: string;
  booking_month: string;
  project_id: string;
  customer_name: string | null;
  deal_value_usd: number;
  is_collected: boolean;
  collection_date: string | null;
  collection_amount_usd: number | null;
  collection_month: string | null;
  first_milestone_due_date: string | null;
  is_clawback_triggered: boolean;
  clawback_amount_usd: number | null;
  clawback_triggered_at: string | null;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined from deals table
  deal?: {
    bu: string;
    product: string;
    type_of_proposal: string;
    sales_rep_name: string | null;
    sales_rep_employee_id: string | null;
    tcv_usd: number | null;
    linked_to_impl: boolean | null;
  };
}

const COLLECTION_SELECT_QUERY = `
  *,
  deal:deals(
    bu,
    product,
    type_of_proposal,
    sales_rep_name,
    sales_rep_employee_id,
    tcv_usd,
    linked_to_impl
  )
`;

export function useCollections(monthYear?: string) {
  return useQuery({
    queryKey: ["deal_collections", monthYear],
    queryFn: async () => {
      let query = supabase
        .from("deal_collections")
        .select(COLLECTION_SELECT_QUERY)
        .order("booking_month", { ascending: false });

      if (monthYear) {
        query = query.eq("booking_month", monthYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DealCollection[];
    },
  });
}

export function useAllCollections() {
  return useQuery({
    queryKey: ["deal_collections", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_collections")
        .select(COLLECTION_SELECT_QUERY)
        .order("booking_month", { ascending: false });

      if (error) throw error;
      return data as DealCollection[];
    },
  });
}

/**
 * Pending collections - cumulative view of all deals not yet collected
 * Sorted by booking month (oldest first - priority)
 */
export function usePendingCollections() {
  return useQuery({
    queryKey: ["deal_collections", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_collections")
        .select(COLLECTION_SELECT_QUERY)
        .eq("is_collected", false)
        .eq("is_clawback_triggered", false)
        .order("booking_month", { ascending: true }); // Oldest first

      if (error) throw error;
      return data as DealCollection[];
    },
  });
}

/**
 * Collected deals - for payroll processing and reporting
 * Optionally filtered by collection month
 */
export function useCollectedDeals(collectionMonth?: string) {
  return useQuery({
    queryKey: ["deal_collections", "collected", collectionMonth],
    queryFn: async () => {
      let query = supabase
        .from("deal_collections")
        .select(COLLECTION_SELECT_QUERY)
        .eq("is_collected", true);

      if (collectionMonth) {
        query = query.eq("collection_month", collectionMonth);
      }

      const { data, error } = await query.order("collection_date", { ascending: false });
      if (error) throw error;
      return data as DealCollection[];
    },
  });
}

export function useUpdateCollectionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      is_collected,
      collection_date,
      collection_amount_usd,
      notes,
    }: {
      id: string;
      is_collected: boolean;
      collection_date?: string | null;
      collection_amount_usd?: number | null;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("deal_collections")
        .update({
          is_collected,
          collection_date: is_collected ? collection_date : null,
          collection_amount_usd: is_collected ? collection_amount_usd : null,
          notes,
          updated_by: user?.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal_collections"] });
      toast({
        title: "Collection updated",
        description: "The collection status has been updated.",
      });
    },
    onError: (error: Error) => {
      const message = error.message.includes("locked payout month")
        ? "Cannot update collection: The booking month is locked for payouts. Use payout adjustments for corrections."
        : error.message;
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useTriggerClawback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      clawback_amount_usd,
    }: {
      id: string;
      clawback_amount_usd: number;
    }) => {
      const { data, error } = await supabase
        .from("deal_collections")
        .update({
          is_clawback_triggered: true,
          clawback_amount_usd,
          clawback_triggered_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal_collections"] });
      toast({
        title: "Clawback triggered",
        description: "The clawback has been recorded for this deal.",
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      const message = error.message.includes("locked payout month")
        ? "Cannot trigger clawback: The booking month is locked for payouts. Use payout adjustments for corrections."
        : error.message;
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useBulkUpdateCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{
        id: string;
        is_collected: boolean;
        collection_date?: string | null;
        collection_amount_usd?: number | null;
      }>
    ) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update each record
      const results = await Promise.all(
        updates.map(async (update) => {
          const { data, error } = await supabase
            .from("deal_collections")
            .update({
              is_collected: update.is_collected,
              collection_date: update.is_collected ? update.collection_date : null,
              collection_amount_usd: update.is_collected ? update.collection_amount_usd : null,
              updated_by: user?.id,
            })
            .eq("id", update.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        })
      );

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deal_collections"] });
      toast({
        title: "Collections updated",
        description: `${data.length} collection records have been updated.`,
      });
    },
    onError: (error: Error) => {
      const message = error.message.includes("locked payout month")
        ? "Cannot update collections: One or more booking months are locked for payouts. Use payout adjustments for corrections."
        : error.message;
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Bulk import collection statuses from CSV/Excel
 * Used by CollectionsBulkUpload component
 */
export function useBulkImportCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{
        id: string;
        is_collected: boolean;
        collection_date?: string | null;
        notes?: string | null;
      }>
    ) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const results = await Promise.all(
        updates.map(async (update) => {
          // Calculate collection_month as first of the month when collected
          const collectionMonth = update.is_collected && update.collection_date
            ? format(parseISO(update.collection_date), "yyyy-MM-01")
            : null;

          const { data, error } = await supabase
            .from("deal_collections")
            .update({
              is_collected: update.is_collected,
              collection_date: update.is_collected ? update.collection_date : null,
              collection_month: collectionMonth,
              notes: update.notes,
              updated_by: user?.id,
            })
            .eq("id", update.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        })
      );

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deal_collections"] });
      toast({
        title: "Import successful",
        description: `${data.length} collection record${data.length !== 1 ? "s" : ""} updated.`,
      });
    },
    onError: (error: Error) => {
      const message = error.message.includes("locked payout month")
        ? "Cannot import: One or more booking months are locked for payouts. Use payout adjustments for corrections."
        : error.message;
      toast({
        title: "Import failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}
