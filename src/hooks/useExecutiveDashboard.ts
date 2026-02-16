import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useMemo } from "react";

export interface MonthlyTrend {
  month: string;
  label: string;
  totalPayout: number;
  avgAttainment: number;
}

export interface AttainmentBucket {
  label: string;
  count: number;
  color: string;
}

export interface FunctionBreakdown {
  name: string;
  value: number;
}

export interface TopPerformer {
  employeeId: string;
  fullName: string;
  role: string;
  region: string;
  salesFunction: string;
  totalPayout: number;
  attainmentPct: number;
  softwareArrAchPct: number;
  closingArrAchPct: number;
}

export interface ExecutiveDashboardData {
  totalPayoutYtd: number;
  globalQuotaAttainment: number;
  payoutVsBudgetPct: number;
  totalBudget: number;
  activePayees: number;
  repsWithTargets: number;
  totalActiveEmployees: number;
  monthlyTrend: MonthlyTrend[];
  attainmentDistribution: AttainmentBucket[];
  payoutByFunction: FunctionBreakdown[];
  topPerformers: TopPerformer[];
}

export function useExecutiveDashboard() {
  const { selectedYear } = useFiscalYear();

  const fyStart = `${selectedYear}-01-01`;
  const fyEnd = `${selectedYear}-12-01`;

  // Step 1: Fetch only finalized/paid payout run IDs for the FY
  const payoutRunsQuery = useQuery({
    queryKey: ["exec-payout-runs", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_runs")
        .select("id")
        .gte("month_year", fyStart)
        .lte("month_year", fyEnd)
        .in("run_status", ["finalized", "paid"]);
      if (error) throw error;
      return data || [];
    },
  });

  const eligibleRunIds = payoutRunsQuery.data?.map((r) => r.id) || [];

  // Step 2: Fetch payouts only from eligible runs
  const currentPayoutsQuery = useQuery({
    queryKey: ["exec-payouts-current", selectedYear, eligibleRunIds],
    queryFn: async () => {
      if (eligibleRunIds.length === 0) return [];
      const { data, error } = await supabase
        .from("monthly_payouts")
        .select("employee_id, month_year, payout_type, calculated_amount_usd")
        .in("payout_run_id", eligibleRunIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !payoutRunsQuery.isLoading,
  });

  const employeesQuery = useQuery({
    queryKey: ["exec-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, sales_function, region, employee_role, tvp_usd, is_active");
      if (error) throw error;
      return data || [];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["exec-targets", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_targets")
        .select("employee_id, metric_type, target_value_usd")
        .eq("effective_year", selectedYear);
      if (error) throw error;
      return data || [];
    },
  });

  const dealsQuery = useQuery({
    queryKey: ["exec-deals", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("sales_rep_employee_id, sales_head_employee_id, new_software_booking_arr_usd, tcv_usd, implementation_usd, cr_usd, er_usd, managed_services_usd")
        .gte("month_year", fyStart)
        .lte("month_year", fyEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const closingArrQuery = useQuery({
    queryKey: ["exec-closing-arr", selectedYear],
    queryFn: async () => {
      const fyEndDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("closing_arr_actuals")
        .select("sales_rep_employee_id, sales_head_employee_id, month_year, closing_arr, end_date")
        .gte("month_year", fyStart)
        .lte("month_year", `${selectedYear}-12-31`);
      if (error) throw error;
      return (data || []).filter(r => r.end_date && r.end_date > fyEndDate);
    },
  });

  const isLoading =
    payoutRunsQuery.isLoading ||
    currentPayoutsQuery.isLoading ||
    employeesQuery.isLoading ||
    targetsQuery.isLoading ||
    dealsQuery.isLoading ||
    closingArrQuery.isLoading;

  const data = useMemo<ExecutiveDashboardData | null>(() => {
    if (isLoading) return null;

    const payouts = currentPayoutsQuery.data || [];
    const employees = employeesQuery.data || [];
    const targets = targetsQuery.data || [];
    const deals = dealsQuery.data || [];
    const closingArrActuals = closingArrQuery.data || [];

    // Maps: UUID <-> string employee_id
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const uuidToStringId = new Map(employees.map((e) => [e.id, e.employee_id]));

    // Total payout YTD (only from finalized/paid runs)
    const totalPayoutYtd = payouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);

    // Active payees
    const activePayeeSet = new Set(
      payouts
        .filter((p) => employeeMap.get(p.employee_id)?.sales_function)
        .map((p) => p.employee_id)
    );
    const activePayees = activePayeeSet.size;

    // Budget = sum of tvp_usd for active employees
    const totalBudget = employees
      .filter((e) => e.is_active)
      .reduce((s, e) => s + (e.tvp_usd || 0), 0);
    const payoutVsBudgetPct = totalBudget > 0 ? (totalPayoutYtd / totalBudget) * 100 : 0;

    // --- Per-employee Software ARR actuals from deals ---
    const empSoftwareActualMap = new Map<string, number>();
    for (const d of deals) {
      const repId = d.sales_rep_employee_id;
      if (repId) {
        empSoftwareActualMap.set(repId, (empSoftwareActualMap.get(repId) || 0) + (d.new_software_booking_arr_usd || 0));
      }
    }

    // --- Per-employee Closing ARR actuals (latest month snapshot) ---
    let latestClosingMonth = "";
    for (const r of closingArrActuals) {
      if (r.month_year > latestClosingMonth) latestClosingMonth = r.month_year;
    }
    const empClosingArrActualMap = new Map<string, number>();
    if (latestClosingMonth) {
      for (const r of closingArrActuals) {
        if (r.month_year !== latestClosingMonth) continue;
        const arr = r.closing_arr || 0;
        if (r.sales_rep_employee_id) {
          empClosingArrActualMap.set(r.sales_rep_employee_id, (empClosingArrActualMap.get(r.sales_rep_employee_id) || 0) + arr);
        }
        if (r.sales_head_employee_id && r.sales_head_employee_id !== r.sales_rep_employee_id) {
          empClosingArrActualMap.set(r.sales_head_employee_id, (empClosingArrActualMap.get(r.sales_head_employee_id) || 0) + arr);
        }
      }
    }

    // --- Per-employee targets split by metric type ---
    const empSoftwareTargetMap = new Map<string, number>();
    const empClosingTargetMap = new Map<string, number>();
    const empTotalTargetMap = new Map<string, number>();
    const empTotalActualMap = new Map<string, number>();

    for (const t of targets) {
      const eid = t.employee_id;
      const val = t.target_value_usd || 0;
      empTotalTargetMap.set(eid, (empTotalTargetMap.get(eid) || 0) + val);
      if (t.metric_type && t.metric_type.includes("New Software Booking ARR")) {
        empSoftwareTargetMap.set(eid, (empSoftwareTargetMap.get(eid) || 0) + val);
      } else if (t.metric_type === "Closing ARR") {
        empClosingTargetMap.set(eid, (empClosingTargetMap.get(eid) || 0) + val);
      }
    }

    // Build total actuals per employee
    for (const d of deals) {
      const repId = d.sales_rep_employee_id;
      if (repId) {
        const dealTotal = (d.new_software_booking_arr_usd || 0) + (d.implementation_usd || 0) + (d.cr_usd || 0) + (d.er_usd || 0) + (d.managed_services_usd || 0);
        empTotalActualMap.set(repId, (empTotalActualMap.get(repId) || 0) + dealTotal);
      }
    }
    for (const [eid, val] of empClosingArrActualMap) {
      empTotalActualMap.set(eid, (empTotalActualMap.get(eid) || 0) + val);
    }

    // Per-employee attainment (Software ARR only)
    const attainments: { employeeId: string; pct: number; targetSize: number }[] = [];
    for (const [empId, swTarget] of empSoftwareTargetMap) {
      if (swTarget > 0) {
        const swActual = empSoftwareActualMap.get(empId) || 0;
        attainments.push({ employeeId: empId, pct: (swActual / swTarget) * 100, targetSize: swTarget });
      }
    }

    // Weighted global quota attainment (Software ARR only)
    const totalTargetWeight = attainments.reduce((s, a) => s + a.targetSize, 0);
    const globalQuotaAttainment = totalTargetWeight > 0
      ? attainments.reduce((s, a) => s + a.pct * (a.targetSize / totalTargetWeight), 0)
      : 0;

    const repsWithTargets = attainments.length;
    const totalActiveEmployees = employees.filter((e) => e.is_active && e.sales_function).length;

    // Attainment distribution histogram
    const buckets = [
      { label: "<50%", min: 0, max: 50, color: "hsl(0 72% 51%)" },
      { label: "50-80%", min: 50, max: 80, color: "hsl(38 92% 50%)" },
      { label: "80-100%", min: 80, max: 100, color: "hsl(210 20% 70%)" },
      { label: "100-120%", min: 100, max: 120, color: "hsl(175 70% 40%)" },
      { label: ">120%", min: 120, max: Infinity, color: "hsl(175 80% 30%)" },
    ];
    const attainmentDistribution: AttainmentBucket[] = buckets.map((b) => ({
      label: b.label,
      count: attainments.filter((a) => a.pct >= b.min && a.pct < b.max).length,
      color: b.color,
    }));

    // Monthly trend
    const monthMap = new Map<string, { total: number; attPcts: number[] }>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 0; m < 12; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}-01`;
      monthMap.set(key, { total: 0, attPcts: [] });
    }
    for (const p of payouts) {
      const entry = monthMap.get(p.month_year);
      if (entry) entry.total += p.calculated_amount_usd || 0;
    }
    for (const p of payouts) {
      const entry = monthMap.get(p.month_year);
      const stringId = uuidToStringId.get(p.employee_id);
      const att = stringId ? attainments.find((a) => a.employeeId === stringId) : undefined;
      if (entry && att) entry.attPcts.push(att.pct);
    }

    const monthlyTrend: MonthlyTrend[] = Array.from(monthMap.entries()).map(([key, val]) => {
      const monthIdx = parseInt(key.substring(5, 7), 10) - 1;
      return {
        month: key,
        label: monthNames[monthIdx],
        totalPayout: val.total,
        avgAttainment: val.attPcts.length > 0 ? val.attPcts.reduce((s, v) => s + v, 0) / val.attPcts.length : 0,
      };
    });

    // Payout by sales function
    const fnMap = new Map<string, number>();
    for (const p of payouts) {
      const emp = employeeMap.get(p.employee_id);
      const fn = emp?.sales_function || "Other";
      fnMap.set(fn, (fnMap.get(fn) || 0) + (p.calculated_amount_usd || 0));
    }
    const payoutByFunction: FunctionBreakdown[] = Array.from(fnMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Per-employee total payouts (keyed by UUID)
    const empPayoutMap = new Map<string, number>();
    for (const p of payouts) {
      empPayoutMap.set(p.employee_id, (empPayoutMap.get(p.employee_id) || 0) + (p.calculated_amount_usd || 0));
    }

    // Top performers
    const topPerformers: TopPerformer[] = Array.from(empPayoutMap.entries())
      .map(([empUuid, total]) => {
        const emp = employeeMap.get(empUuid);
        const stringId = uuidToStringId.get(empUuid) || "";
        const att = attainments.find((a) => a.employeeId === stringId);

        const swTarget = empSoftwareTargetMap.get(stringId) || 0;
        const swActual = empSoftwareActualMap.get(stringId) || 0;
        const softwareArrAchPct = swTarget > 0 ? (swActual / swTarget) * 100 : 0;

        const clTarget = empClosingTargetMap.get(stringId) || 0;
        const clActual = empClosingArrActualMap.get(stringId) || 0;
        const closingArrAchPct = clTarget > 0 ? (clActual / clTarget) * 100 : 0;

        return {
          employeeId: empUuid,
          fullName: emp?.full_name || "Unknown",
          role: emp?.employee_role || "",
          region: emp?.region || "",
          salesFunction: emp?.sales_function || "",
          totalPayout: total,
          attainmentPct: att?.pct || 0,
          softwareArrAchPct,
          closingArrAchPct,
        };
      })
      .sort((a, b) => b.totalPayout - a.totalPayout)
      .slice(0, 5);

    return {
      totalPayoutYtd,
      globalQuotaAttainment,
      payoutVsBudgetPct,
      totalBudget,
      activePayees,
      monthlyTrend,
      attainmentDistribution,
      payoutByFunction,
      topPerformers,
      repsWithTargets,
      totalActiveEmployees,
    };
  }, [isLoading, currentPayoutsQuery.data, employeesQuery.data, targetsQuery.data, dealsQuery.data, closingArrQuery.data, selectedYear]);

  return { data, isLoading };
}
