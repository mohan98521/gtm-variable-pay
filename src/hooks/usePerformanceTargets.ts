import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

export interface PerformanceTargetRow {
  employee_id: string;
  full_name: string;
  metric_type: string;
  effective_year: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  annual: number;
}

export interface QuarterlyTargetInput {
  employee_id: string;
  metric_type: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export function usePerformanceTargets() {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["performance_targets", selectedYear],
    queryFn: async (): Promise<PerformanceTargetRow[]> => {
      // First get all quarterly targets for the year
      const { data: quarterlyData, error: quarterlyError } = await supabase
        .from("quarterly_targets")
        .select("employee_id, metric_type, quarter, target_value_usd, effective_year")
        .eq("effective_year", selectedYear);

      if (quarterlyError) throw quarterlyError;

      // Get employee data
      const { data: employees, error: employeesError } = await supabase
        .from("employees")
        .select("employee_id, full_name");

      if (employeesError) throw employeesError;

      const employeeMap = new Map(employees?.map(e => [e.employee_id, e.full_name]) || []);

      // Group by employee_id + metric_type
      const groupedData = new Map<string, PerformanceTargetRow>();

      quarterlyData?.forEach((qt) => {
        const key = `${qt.employee_id}|${qt.metric_type}`;
        
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            employee_id: qt.employee_id,
            full_name: employeeMap.get(qt.employee_id) || qt.employee_id,
            metric_type: qt.metric_type,
            effective_year: qt.effective_year,
            q1: 0,
            q2: 0,
            q3: 0,
            q4: 0,
            annual: 0,
          });
        }

        const row = groupedData.get(key)!;
        if (qt.quarter === 1) row.q1 = qt.target_value_usd;
        if (qt.quarter === 2) row.q2 = qt.target_value_usd;
        if (qt.quarter === 3) row.q3 = qt.target_value_usd;
        if (qt.quarter === 4) row.q4 = qt.target_value_usd;
        row.annual = row.q1 + row.q2 + row.q3 + row.q4;
      });

      return Array.from(groupedData.values()).sort((a, b) => 
        a.full_name.localeCompare(b.full_name)
      );
    },
  });
}

export function useEmployeeTargetDetails(employeeId: string | null, metricType: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["employee_target_details", employeeId, metricType, selectedYear],
    queryFn: async () => {
      if (!employeeId || !metricType) return null;

      const { data, error } = await supabase
        .from("quarterly_targets")
        .select("quarter, target_value_usd")
        .eq("employee_id", employeeId)
        .eq("metric_type", metricType)
        .eq("effective_year", selectedYear);

      if (error) throw error;

      const result = { q1: 0, q2: 0, q3: 0, q4: 0 };
      data?.forEach((qt) => {
        if (qt.quarter === 1) result.q1 = qt.target_value_usd;
        if (qt.quarter === 2) result.q2 = qt.target_value_usd;
        if (qt.quarter === 3) result.q3 = qt.target_value_usd;
        if (qt.quarter === 4) result.q4 = qt.target_value_usd;
      });

      return result;
    },
    enabled: !!employeeId && !!metricType,
  });
}

export function useCreatePerformanceTarget() {
  const queryClient = useQueryClient();
  const { selectedYear } = useFiscalYear();

  return useMutation({
    mutationFn: async (input: QuarterlyTargetInput) => {
      const { employee_id, metric_type, q1, q2, q3, q4 } = input;
      const annual = q1 + q2 + q3 + q4;

      // Delete existing quarterly targets for this combination
      await supabase
        .from("quarterly_targets")
        .delete()
        .eq("employee_id", employee_id)
        .eq("metric_type", metric_type)
        .eq("effective_year", selectedYear);

      // Insert new quarterly targets
      const quarterlyRecords = [
        { employee_id, metric_type, quarter: 1, target_value_usd: q1, effective_year: selectedYear },
        { employee_id, metric_type, quarter: 2, target_value_usd: q2, effective_year: selectedYear },
        { employee_id, metric_type, quarter: 3, target_value_usd: q3, effective_year: selectedYear },
        { employee_id, metric_type, quarter: 4, target_value_usd: q4, effective_year: selectedYear },
      ];

      const { error: insertError } = await supabase
        .from("quarterly_targets")
        .insert(quarterlyRecords);

      if (insertError) throw insertError;

      // Upsert the performance_targets record
      const { error: upsertError } = await supabase
        .from("performance_targets")
        .upsert(
          {
            employee_id,
            metric_type,
            target_value_usd: annual,
            effective_year: selectedYear,
          },
          {
            onConflict: "employee_id,metric_type,effective_year",
          }
        );

      if (upsertError) throw upsertError;

      return { employee_id, metric_type, annual };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_targets"] });
      queryClient.invalidateQueries({ queryKey: ["employee_target_details"] });
    },
  });
}

export function useDeletePerformanceTarget() {
  const queryClient = useQueryClient();
  const { selectedYear } = useFiscalYear();

  return useMutation({
    mutationFn: async ({ employee_id, metric_type }: { employee_id: string; metric_type: string }) => {
      // Delete quarterly targets
      const { error: qtError } = await supabase
        .from("quarterly_targets")
        .delete()
        .eq("employee_id", employee_id)
        .eq("metric_type", metric_type)
        .eq("effective_year", selectedYear);

      if (qtError) throw qtError;

      // Delete performance target
      const { error: ptError } = await supabase
        .from("performance_targets")
        .delete()
        .eq("employee_id", employee_id)
        .eq("metric_type", metric_type)
        .eq("effective_year", selectedYear);

      if (ptError) throw ptError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_targets"] });
      queryClient.invalidateQueries({ queryKey: ["employee_target_details"] });
    },
  });
}

export function useEmployeesWithoutTargets(metricType?: string) {
  const { selectedYear } = useFiscalYear();
  const { data: allTargets } = usePerformanceTargets();

  return useQuery({
    queryKey: ["employees_without_targets", selectedYear, metricType],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;

      // Get employee IDs that have targets for this metric
      const employeeIdsWithTargets = new Set(
        allTargets
          ?.filter(t => !metricType || t.metric_type === metricType)
          .map(t => t.employee_id) || []
      );

      return employees?.filter(e => !employeeIdsWithTargets.has(e.employee_id)) || [];
    },
    enabled: !!allTargets,
  });
}

export function useMetricTypes() {
  return useQuery({
    queryKey: ["metric_types"],
    queryFn: async () => {
      // Fetch metrics from plan_metrics table
      const { data: metricsData, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("metric_name");

      if (metricsError) throw metricsError;

      // Fetch commission types from plan_commissions table
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("plan_commissions")
        .select("commission_type");

      if (commissionsError) throw commissionsError;

      // Combine both sources
      const metricNames = metricsData?.map(m => m.metric_name) || [];
      const commissionTypes = commissionsData?.map(c => c.commission_type) || [];

      // Guarantee CR/ER and Implementation are always available (needed for NRR computation)
      const GUARANTEED_METRICS = ["CR/ER", "Implementation"];
      const allMetrics = [...new Set([...GUARANTEED_METRICS, ...metricNames, ...commissionTypes])].sort();

      return allMetrics;
    },
  });
}

export function useBulkCreatePerformanceTargets() {
  const queryClient = useQueryClient();
  const { selectedYear } = useFiscalYear();

  return useMutation({
    mutationFn: async (inputs: QuarterlyTargetInput[]) => {
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const input of inputs) {
        try {
          const { employee_id, metric_type, q1, q2, q3, q4 } = input;
          const annual = q1 + q2 + q3 + q4;

          // Check if exists
          const { data: existing } = await supabase
            .from("quarterly_targets")
            .select("id")
            .eq("employee_id", employee_id)
            .eq("metric_type", metric_type)
            .eq("effective_year", selectedYear)
            .limit(1);

          const isUpdate = existing && existing.length > 0;

          // Delete existing quarterly targets
          await supabase
            .from("quarterly_targets")
            .delete()
            .eq("employee_id", employee_id)
            .eq("metric_type", metric_type)
            .eq("effective_year", selectedYear);

          // Insert new quarterly targets
          const quarterlyRecords = [
            { employee_id, metric_type, quarter: 1, target_value_usd: q1, effective_year: selectedYear },
            { employee_id, metric_type, quarter: 2, target_value_usd: q2, effective_year: selectedYear },
            { employee_id, metric_type, quarter: 3, target_value_usd: q3, effective_year: selectedYear },
            { employee_id, metric_type, quarter: 4, target_value_usd: q4, effective_year: selectedYear },
          ];

          const { error: insertError } = await supabase
            .from("quarterly_targets")
            .insert(quarterlyRecords);

          if (insertError) throw insertError;

          // Upsert performance_targets
          const { error: upsertError } = await supabase
            .from("performance_targets")
            .upsert(
              {
                employee_id,
                metric_type,
                target_value_usd: annual,
                effective_year: selectedYear,
              },
              {
                onConflict: "employee_id,metric_type,effective_year",
              }
            );

          if (upsertError) throw upsertError;

          if (isUpdate) {
            updated++;
          } else {
            created++;
          }
        } catch (err) {
          errors.push(`Error for ${input.employee_id}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      return { created, updated, errors };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_targets"] });
      queryClient.invalidateQueries({ queryKey: ["employee_target_details"] });
    },
  });
}
