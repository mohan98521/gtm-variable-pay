import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Deal {
  id: string;
  project_id: string;
  customer_code: string;
  region: string;
  country: string;
  bu: string;
  product: string;
  type_of_proposal: string;
  gp_margin_percent: number | null;
  month_year: string;
  first_year_amc_usd: number | null;
  first_year_subscription_usd: number | null;
  new_software_booking_arr_usd: number | null;
  managed_services_usd: number | null;
  implementation_usd: number | null;
  cr_usd: number | null;
  er_usd: number | null;
  tcv_usd: number | null;
  sales_rep_employee_id: string | null;
  sales_rep_name: string | null;
  sales_head_employee_id: string | null;
  sales_head_name: string | null;
  sales_engineering_employee_id: string | null;
  sales_engineering_name: string | null;
  sales_engineering_head_employee_id: string | null;
  sales_engineering_head_name: string | null;
  product_specialist_employee_id: string | null;
  product_specialist_name: string | null;
  product_specialist_head_employee_id: string | null;
  product_specialist_head_name: string | null;
  solution_manager_employee_id: string | null;
  solution_manager_name: string | null;
  solution_manager_head_employee_id: string | null;
  solution_manager_head_name: string | null;
  linked_to_impl: boolean | null;
  eligible_for_perpetual_incentive: boolean | null;
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
  project_id: string;
  customer_code: string;
  region: string;
  country: string;
  bu: string;
  product: string;
  type_of_proposal: string;
  gp_margin_percent?: number;
  month_year: string;
  first_year_amc_usd?: number;
  first_year_subscription_usd?: number;
  managed_services_usd?: number;
  implementation_usd?: number;
  cr_usd?: number;
  er_usd?: number;
  tcv_usd?: number;
  sales_rep_employee_id?: string;
  sales_rep_name?: string;
  sales_head_employee_id?: string;
  sales_head_name?: string;
  sales_engineering_employee_id?: string;
  sales_engineering_name?: string;
  sales_engineering_head_employee_id?: string;
  sales_engineering_head_name?: string;
  product_specialist_employee_id?: string;
  product_specialist_name?: string;
  product_specialist_head_employee_id?: string;
  product_specialist_head_name?: string;
  solution_manager_employee_id?: string;
  solution_manager_name?: string;
  solution_manager_head_employee_id?: string;
  solution_manager_head_name?: string;
  linked_to_impl?: boolean;
  eligible_for_perpetual_incentive?: boolean;
  status?: string;
  notes?: string;
  participants?: Omit<DealParticipant, "id" | "deal_id" | "created_at">[];
}

export interface UpdateDealInput extends Partial<CreateDealInput> {
  id: string;
}

export const PROPOSAL_TYPES = [
  { value: "amc", label: "AMC" },
  { value: "subscription", label: "Subscription" },
  { value: "managed_services", label: "Managed Services" },
  { value: "perpetual_licence", label: "Perpetual Licence" },
  { value: "cr", label: "CR (Change Request)" },
  { value: "er", label: "ER (Enhancement Request)" },
  { value: "implementation", label: "Implementation" },
] as const;

export const BUSINESS_UNITS = [
  { value: "banking", label: "Banking" },
  { value: "insurance", label: "Insurance" },
  { value: "wealth", label: "Wealth Management" },
  { value: "capital_markets", label: "Capital Markets" },
  { value: "corporate", label: "Corporate" },
] as const;

export const PARTICIPANT_ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "sales_head", label: "Sales Head" },
  { value: "sales_engineering", label: "Sales Engineering" },
  { value: "sales_engineering_head", label: "Sales Engineering Head" },
  { value: "product_specialist", label: "Product Specialist" },
  { value: "product_specialist_head", label: "Product Specialist Head" },
  { value: "solution_manager", label: "Solution Manager" },
  { value: "solution_manager_head", label: "Solution Manager Head" },
] as const;

export const DEAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function useDeals(monthYear?: string, proposalType?: string) {
  return useQuery({
    queryKey: ["deals", monthYear, proposalType],
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

      if (proposalType) {
        query = query.eq("type_of_proposal", proposalType);
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
      if (participants && participants.length > 0) {
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

export function generateProjectId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `PRJ-${timestamp}-${random}`;
}
