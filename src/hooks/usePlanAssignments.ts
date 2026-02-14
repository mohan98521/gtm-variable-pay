import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

// Helper function to check if two date ranges overlap
function datesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 <= end2 && end1 >= start2;
}

// Check for overlapping assignments for a user
async function checkOverlappingAssignments(
  userId: string,
  startDate: string,
  endDate: string,
  excludeAssignmentId?: string
): Promise<{ hasOverlap: boolean; conflictingPlan?: { name: string; startDate: string; endDate: string } }> {
  // Fetch all existing assignments for this user
  const { data: assignments, error } = await supabase
    .from("user_targets")
    .select(`
      id,
      effective_start_date,
      effective_end_date,
      comp_plans:plan_id (
        name
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;
  if (!assignments || assignments.length === 0) {
    return { hasOverlap: false };
  }

  // Check each assignment for overlap
  for (const assignment of assignments) {
    // Skip the current assignment when editing
    if (excludeAssignmentId && assignment.id === excludeAssignmentId) {
      continue;
    }

    if (datesOverlap(startDate, endDate, assignment.effective_start_date, assignment.effective_end_date)) {
      const planName = (assignment.comp_plans as any)?.name || "Unknown Plan";
      return {
        hasOverlap: true,
        conflictingPlan: {
          name: planName,
          startDate: assignment.effective_start_date,
          endDate: assignment.effective_end_date,
        },
      };
    }
  }

  return { hasOverlap: false };
}

// Fetch employee tenure dates
async function fetchEmployeeTenure(userId: string): Promise<{ date_of_hire: string | null; departure_date: string | null }> {
  const { data, error } = await supabase
    .from("employees")
    .select("date_of_hire, departure_date")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return { date_of_hire: data?.date_of_hire ?? null, departure_date: data?.departure_date ?? null };
}

// Validate and clamp assignment dates against employee tenure
function validateTenureBoundary(
  startDate: string,
  endDate: string,
  tenure: { date_of_hire: string | null; departure_date: string | null }
): { clampedEndDate: string; warnings: string[] } {
  const warnings: string[] = [];
  let clampedEndDate = endDate;

  if (tenure.date_of_hire && startDate < tenure.date_of_hire) {
    warnings.push(`Assignment start date is before employee's joining date (${tenure.date_of_hire}). It will only be effective from their joining date.`);
  }

  if (tenure.departure_date && endDate > tenure.departure_date) {
    clampedEndDate = tenure.departure_date;
    warnings.push(`Assignment end date was clamped to employee's departure date (${tenure.departure_date}).`);
  }

  return { clampedEndDate, warnings };
}

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
      // Tenure validation
      const tenure = await fetchEmployeeTenure(input.user_id);
      const { clampedEndDate, warnings } = validateTenureBoundary(
        input.effective_start_date,
        input.effective_end_date,
        tenure
      );
      const effectiveEndDate = clampedEndDate;

      // Check for overlapping assignments before inserting
      const overlapCheck = await checkOverlappingAssignments(
        input.user_id,
        input.effective_start_date,
        effectiveEndDate
      );

      if (overlapCheck.hasOverlap && overlapCheck.conflictingPlan) {
        const { name, startDate, endDate } = overlapCheck.conflictingPlan;
        const formattedStart = format(new Date(startDate), "MMM yyyy");
        const formattedEnd = format(new Date(endDate), "MMM yyyy");
        throw new Error(
          `This employee already has a plan assignment during this period: ${name} (${formattedStart} - ${formattedEnd}). Please adjust the effective dates or remove the existing assignment first.`
        );
      }

      const { data, error } = await supabase
        .from("user_targets")
        .insert({
          user_id: input.user_id,
          plan_id: input.plan_id,
          effective_start_date: input.effective_start_date,
          effective_end_date: effectiveEndDate,
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

      // Show tenure warnings after success
      if (warnings.length > 0) {
        warnings.forEach(w => toast.warning(w));
      }

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
      // Tenure validation
      const tenure = await fetchEmployeeTenure(input.user_id);
      const { clampedEndDate, warnings } = validateTenureBoundary(
        input.effective_start_date,
        input.effective_end_date,
        tenure
      );
      const effectiveEndDate = clampedEndDate;

      // Check for overlapping assignments before updating (exclude current assignment)
      const overlapCheck = await checkOverlappingAssignments(
        input.user_id,
        input.effective_start_date,
        effectiveEndDate,
        input.id
      );

      if (overlapCheck.hasOverlap && overlapCheck.conflictingPlan) {
        const { name, startDate, endDate } = overlapCheck.conflictingPlan;
        const formattedStart = format(new Date(startDate), "MMM yyyy");
        const formattedEnd = format(new Date(endDate), "MMM yyyy");
        throw new Error(
          `This employee already has a plan assignment during this period: ${name} (${formattedStart} - ${formattedEnd}). Please adjust the effective dates or remove the existing assignment first.`
        );
      }

      const { data, error } = await supabase
        .from("user_targets")
        .update({
          plan_id: input.plan_id,
          effective_start_date: input.effective_start_date,
          effective_end_date: effectiveEndDate,
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

      // Show tenure warnings after success
      if (warnings.length > 0) {
        warnings.forEach(w => toast.warning(w));
      }

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

/**
 * Split an existing assignment at an effective date.
 * Ends the old assignment the day before, creates a new one from the effective date
 * with updated compensation values.
 */
export function useSplitAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      effectiveDate,
      newOteUsd,
      newOteLocal,
      newTfpUsd,
      newTfpLocal,
      newTargetBonusUsd,
      newTargetBonusPercent,
    }: {
      assignmentId: string;
      effectiveDate: string;
      newOteUsd?: number | null;
      newOteLocal?: number | null;
      newTfpUsd?: number | null;
      newTfpLocal?: number | null;
      newTargetBonusUsd?: number | null;
      newTargetBonusPercent?: number | null;
    }) => {
      // 1. Fetch the existing assignment
      const { data: existing, error: fetchErr } = await supabase
        .from("user_targets")
        .select("*")
        .eq("id", assignmentId)
        .single();

      if (fetchErr || !existing) throw new Error("Assignment not found");

      // 2. Calculate day before effective date
      const dayBefore = new Date(effectiveDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayBeforeStr = format(dayBefore, "yyyy-MM-dd");

      // 3. End existing assignment on day before
      const { error: updateErr } = await supabase
        .from("user_targets")
        .update({ effective_end_date: dayBeforeStr })
        .eq("id", assignmentId);

      if (updateErr) throw updateErr;

      // 4. Create new assignment from effective date
      const { data: newAssignment, error: insertErr } = await supabase
        .from("user_targets")
        .insert({
          user_id: existing.user_id,
          plan_id: existing.plan_id,
          effective_start_date: effectiveDate,
          effective_end_date: existing.effective_end_date,
          target_value_annual: existing.target_value_annual,
          currency: existing.currency,
          target_bonus_percent: newTargetBonusPercent ?? existing.target_bonus_percent,
          tfp_local_currency: newTfpLocal ?? existing.tfp_local_currency,
          ote_local_currency: newOteLocal ?? existing.ote_local_currency,
          tfp_usd: newTfpUsd ?? existing.tfp_usd,
          target_bonus_usd: newTargetBonusUsd ?? existing.target_bonus_usd,
          ote_usd: newOteUsd ?? existing.ote_usd,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      return { oldAssignment: existing, newAssignment };
    },
    onSuccess: (data) => {
      toast.success("Assignment split successfully");
      queryClient.invalidateQueries({ queryKey: ["employee_plan_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["plan_assigned_employees"] });
      queryClient.invalidateQueries({ queryKey: ["user_targets"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to split assignment", { description: error.message });
    },
  });
}
