import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlanAssignment {
  id: string;
  user_id: string;
  plan_id: string;
  effective_start_date: string;
  effective_end_date: string;
  target_value_annual: number;
  currency: string;
  target_bonus_percent: number | null;
  tfp_local_currency: number | null;
  ote_local_currency: number | null;
  tfp_usd: number | null;
  target_bonus_usd: number | null;
  ote_usd: number | null;
  created_at: string;
}

export interface PlanAssignmentWithDetails extends PlanAssignment {
  plan_name?: string;
  employee_name?: string;
  employee_id?: string;
}

export interface CreatePlanAssignmentInput {
  user_id: string;
  plan_id: string;
  effective_start_date: string;
  effective_end_date: string;
  target_value_annual: number;
  currency: string;
  target_bonus_percent?: number | null;
  tfp_local_currency?: number | null;
  ote_local_currency?: number | null;
  tfp_usd?: number | null;
  target_bonus_usd?: number | null;
  ote_usd?: number | null;
}

// Get all assignments for an employee (via their profile user_id)
export function useEmployeePlanAssignments(userId?: string) {
  return useQuery({
    queryKey: ["employee_plan_assignments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_targets")
        .select(`
          *,
          comp_plans:plan_id (
            id,
            name,
            effective_year
          )
        `)
        .eq("user_id", userId)
        .order("effective_start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Get all employees assigned to a specific plan
export function usePlanAssignedEmployees(planId?: string) {
  return useQuery({
    queryKey: ["plan_assigned_employees", planId],
    queryFn: async () => {
      if (!planId) return [];
      
      // First get all user_targets for this plan
      const { data: targets, error: targetsError } = await supabase
        .from("user_targets")
        .select("*")
        .eq("plan_id", planId)
        .order("effective_start_date", { ascending: false });

      if (targetsError) throw targetsError;
      if (!targets || targets.length === 0) return [];

      // Get employee details for all user_ids
      const userIds = [...new Set(targets.map(t => t.user_id))];
      
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, email, local_currency, is_active")
        .in("id", userIds);

      if (empError) throw empError;

      // Merge data
      return targets.map(target => {
        const employee = employees?.find(e => e.id === target.user_id);
        return {
          ...target,
          employee_name: employee?.full_name || "Unknown",
          employee_id: employee?.employee_id || "",
          employee_email: employee?.email || "",
          employee_is_active: employee?.is_active ?? false,
        };
      });
    },
    enabled: !!planId,
  });
}

// Find profile by email
export async function findProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Check if employee has a profile (auth account)
export async function checkEmployeeHasProfile(employeeEmail: string) {
  const profile = await findProfileByEmail(employeeEmail);
  return !!profile;
}

// Create a plan assignment
export function useCreatePlanAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlanAssignmentInput) => {
      const { data, error } = await supabase
        .from("user_targets")
        .insert({
          user_id: input.user_id,
          plan_id: input.plan_id,
          effective_start_date: input.effective_start_date,
          effective_end_date: input.effective_end_date,
          target_value_annual: input.target_value_annual,
          currency: input.currency,
          target_bonus_percent: input.target_bonus_percent,
          tfp_local_currency: input.tfp_local_currency,
          ote_local_currency: input.ote_local_currency,
          tfp_usd: input.tfp_usd,
          target_bonus_usd: input.target_bonus_usd,
          ote_usd: input.ote_usd,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success("Plan assignment created successfully");
      queryClient.invalidateQueries({ queryKey: ["employee_plan_assignments", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["plan_assigned_employees", variables.plan_id] });
      queryClient.invalidateQueries({ queryKey: ["user_targets"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create assignment", { description: error.message });
    },
  });
}

// Update an existing plan assignment
export function useUpdatePlanAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlanAssignmentInput & { id: string }) => {
      const { data, error } = await supabase
        .from("user_targets")
        .update({
          plan_id: input.plan_id,
          effective_start_date: input.effective_start_date,
          effective_end_date: input.effective_end_date,
          target_value_annual: input.target_value_annual,
          currency: input.currency,
          target_bonus_percent: input.target_bonus_percent,
          tfp_local_currency: input.tfp_local_currency,
          ote_local_currency: input.ote_local_currency,
          tfp_usd: input.tfp_usd,
          target_bonus_usd: input.target_bonus_usd,
          ote_usd: input.ote_usd,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success("Plan assignment updated successfully");
      queryClient.invalidateQueries({ queryKey: ["employee_plan_assignments", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["plan_assigned_employees", variables.plan_id] });
      queryClient.invalidateQueries({ queryKey: ["user_targets"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update assignment", { description: error.message });
    },
  });
}

// Delete a plan assignment
export function useDeletePlanAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId, planId }: { id: string; userId: string; planId: string }) => {
      const { error } = await supabase
        .from("user_targets")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { userId, planId };
    },
    onSuccess: (data) => {
      toast.success("Plan assignment removed");
      queryClient.invalidateQueries({ queryKey: ["employee_plan_assignments", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["plan_assigned_employees", data.planId] });
      queryClient.invalidateQueries({ queryKey: ["user_targets"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to remove assignment", { description: error.message });
    },
  });
}

// Get assignment count for an employee
export function useEmployeeAssignmentCount(userId?: string) {
  return useQuery({
    queryKey: ["employee_assignment_count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count, error } = await supabase
        .from("user_targets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}
