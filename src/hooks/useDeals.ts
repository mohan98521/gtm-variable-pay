import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Deal {
  id: string;
  deal_id: string;
  deal_name: string;
  client_name: string;
  metric_type: string;
  month_year: string;
  deal_value_usd: number;
  deal_value_local: number | null;
  local_currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealParticipant {
  id: string;
  deal_id: string;
  employee_id: string;
  participant_role: string;
  split_percent: number;
  created_at: string;
}

export interface DealWithParticipants extends Deal {
  deal_participants: DealParticipant[];
}

export interface CreateDealInput {
  deal_id: string;
  deal_name: string;
  client_name: string;
  metric_type: string;
  month_year: string;
  deal_value_usd: number;
  deal_value_local?: number;
  local_currency: string;
  status?: string;
  notes?: string;
  participants: Omit<DealParticipant, "id" | "deal_id" | "created_at">[];
}

export interface UpdateDealInput extends Partial<CreateDealInput> {
  id: string;
}

export const METRIC_TYPES = [
  { value: "software_arr", label: "New Software Booking ARR" },
  { value: "managed_services", label: "Managed Services / PS" },
  { value: "cr_er", label: "CR/ER (Contract Renewal / Extension)" },
  { value: "implementation", label: "Implementation" },
  { value: "perpetual_license", label: "Perpetual License" },
  { value: "premium_support", label: "Premium Support" },
] as const;

export const PARTICIPANT_ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "sales_head", label: "Sales Head" },
  { value: "se", label: "Solutions Engineer" },
  { value: "channel_rep", label: "Channel Sales Rep" },
  { value: "product_specialist", label: "Product Specialist" },
] as const;

export const DEAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function useDeals(monthYear?: string, metricType?: string) {
  return useQuery({
    queryKey: ["deals", monthYear, metricType],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          *,
          deal_participants (*)
        `)
        .order("created_at", { ascending: false });

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      if (metricType) {
        query = query.eq("metric_type", metricType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DealWithParticipants[];
    },
  });
}

export function useDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;

      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          deal_participants (*)
        `)
        .eq("id", dealId)
        .maybeSingle();

      if (error) throw error;
      return data as DealWithParticipants | null;
    },
    enabled: !!dealId,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDealInput) => {
      const { participants, ...dealData } = input;

      // Insert the deal
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert(dealData)
        .select()
        .single();

      if (dealError) throw dealError;

      // Insert participants if any
      if (participants.length > 0) {
        const participantsWithDealId = participants.map((p) => ({
          ...p,
          deal_id: deal.id,
        }));

        const { error: participantsError } = await supabase
          .from("deal_participants")
          .insert(participantsWithDealId);

        if (participantsError) throw participantsError;
      }

      return deal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create deal: ${error.message}`);
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateDealInput) => {
      const { id, participants, ...dealData } = input;

      // Update the deal
      const { error: dealError } = await supabase
        .from("deals")
        .update(dealData)
        .eq("id", id);

      if (dealError) throw dealError;

      // If participants are provided, replace them
      if (participants) {
        // Delete existing participants
        const { error: deleteError } = await supabase
          .from("deal_participants")
          .delete()
          .eq("deal_id", id);

        if (deleteError) throw deleteError;

        // Insert new participants
        if (participants.length > 0) {
          const participantsWithDealId = participants.map((p) => ({
            ...p,
            deal_id: id,
          }));

          const { error: participantsError } = await supabase
            .from("deal_participants")
            .insert(participantsWithDealId);

          if (participantsError) throw participantsError;
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update deal: ${error.message}`);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", dealId);

      if (error) throw error;
      return dealId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete deal: ${error.message}`);
    },
  });
}

export function generateDealId(metricType: string): string {
  const prefix = metricType.toUpperCase().slice(0, 3);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
