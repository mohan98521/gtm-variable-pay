import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChangeType = 'hike' | 'promotion' | 'transfer' | 'correction' | 'new_joiner' | 'departure';

export interface EmployeeChangeLogEntry {
  id: string;
  employee_id: string;
  changed_at: string;
  changed_by: string | null;
  change_type: ChangeType;
  change_reason: string | null;
  field_changes: Record<string, { old: unknown; new: unknown }>;
  effective_date: string;
}

export interface LogEmployeeChangeInput {
  employee_id: string;
  change_type: ChangeType;
  change_reason?: string;
  field_changes: Record<string, { old: unknown; new: unknown }>;
  effective_date: string;
}

/** Fetch change history for a specific employee */
export function useEmployeeChangeLog(employeeId?: string) {
  return useQuery({
    queryKey: ["employee_change_log", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("employee_change_log" as any)
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as EmployeeChangeLogEntry[];
    },
    enabled: !!employeeId,
  });
}

/** Insert a change log entry */
export function useLogEmployeeChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogEmployeeChangeInput) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("employee_change_log" as any)
        .insert({
          employee_id: input.employee_id,
          change_type: input.change_type,
          change_reason: input.change_reason || null,
          field_changes: input.field_changes,
          effective_date: input.effective_date,
          changed_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee_change_log", variables.employee_id] });
    },
    onError: (error: Error) => {
      console.error("Failed to log employee change:", error);
    },
  });
}

/** Detect which compensation-relevant fields changed between old and new employee data */
export function detectCompensationChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const compensationFields = [
    'tfp_local_currency', 'tvp_local_currency', 'ote_local_currency',
    'tfp_usd', 'tvp_usd', 'ote_usd',
    'target_bonus_percent', 'sales_function', 'employee_role',
    'incentive_type', 'local_currency', 'designation',
    'business_unit', 'department', 'region', 'departure_date',
  ];

  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of compensationFields) {
    const oldVal = oldData[field] ?? null;
    const newVal = newData[field] ?? null;
    // Normalize empty strings to null for comparison
    const normalizedOld = oldVal === "" ? null : oldVal;
    const normalizedNew = newVal === "" ? null : newVal;

    if (normalizedOld !== normalizedNew) {
      changes[field] = { old: normalizedOld, new: normalizedNew };
    }
  }

  return changes;
}

/** Check if any compensation-impacting field has changed */
export function hasCompensationChanges(changes: Record<string, { old: unknown; new: unknown }>): boolean {
  const compensationOnlyFields = [
    'tfp_local_currency', 'tvp_local_currency', 'ote_local_currency',
    'tfp_usd', 'tvp_usd', 'ote_usd',
    'target_bonus_percent', 'sales_function',
  ];
  return compensationOnlyFields.some(field => field in changes);
}
