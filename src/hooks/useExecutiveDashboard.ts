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
}

export interface ExecutiveDashboardData {
  totalPayoutYtd: number;
  totalPayoutPriorYear: number;
  yoyChangePct: number;
  globalQuotaAttainment: number;
  payoutVsBudgetPct: number;
  totalBudget: number;
  activePayees: number;
  monthlyTrend: MonthlyTrend[];
  attainmentDistribution: AttainmentBucket[];
  payoutByFunction: FunctionBreakdown[];
  topPerformers: TopPerformer[];
}

export function useExecutiveDashboard() {
  const { selectedYear } = useFiscalYear();

  const fyStart = `${selectedYear}-01-01`;
  const fyEnd = `${selectedYear}-12-01`;
  const priorFyStart = `${selectedYear - 1}-01-01`;
  const priorFyEnd = `${selectedYear - 1}-12-01`;

  const currentPayoutsQuery = useQuery({
    queryKey: ["exec-payouts-current", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_payouts")
        .select("employee_id, month_year, payout_type, calculated_amount_usd, calculated_amount_local, local_currency")
        .gte("month_year", fyStart)
        .lte("month_year", fyEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const priorPayoutsQuery = useQuery({
    queryKey: ["exec-payouts-prior", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_payouts")
        .select("calculated_amount_usd")
        .gte("month_year", priorFyStart)
        .lte("month_year", priorFyEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["exec-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, sales_function, region, employee_role, tvp_usd, is_active");
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

  // Fetch deals for the fiscal year to compute actuals per employee
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

  const isLoading =
    currentPayoutsQuery.isLoading ||
    priorPayoutsQuery.isLoading ||
    employeesQuery.isLoading ||
    targetsQuery.isLoading ||
    dealsQuery.isLoading;

  const data = useMemo<ExecutiveDashboardData | null>(() => {
    if (isLoading) return null;

    const payouts = currentPayoutsQuery.data || [];
    const priorPayouts = priorPayoutsQuery.data || [];
    const employees = employeesQuery.data || [];
    const targets = targetsQuery.data || [];
    const deals = dealsQuery.data || [];

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Total payout YTD
    const totalPayoutYtd = payouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);
    const totalPayoutPriorYear = priorPayouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);
    const yoyChangePct = totalPayoutPriorYear > 0
      ? ((totalPayoutYtd - totalPayoutPriorYear) / totalPayoutPriorYear) * 100
      : 0;

    // Active payees
    const activePayeeSet = new Set(payouts.map((p) => p.employee_id));
    const activePayees = activePayeeSet.size;

    // Budget (sum of tvp_usd for active employees)
    const totalBudget = employees
      .filter((e) => e.is_active)
      .reduce((s, e) => s + (e.tvp_usd || 0), 0);
    const payoutVsBudgetPct = totalBudget > 0 ? (totalPayoutYtd / totalBudget) * 100 : 0;

    // Per-employee actuals from deals (aggregate by sales_rep)
    const empActualMap = new Map<string, number>();
    for (const d of deals) {
      const repId = d.sales_rep_employee_id;
      if (repId) {
        const dealTotal = (d.new_software_booking_arr_usd || 0) + (d.implementation_usd || 0) + (d.cr_usd || 0) + (d.er_usd || 0) + (d.managed_services_usd || 0);
        empActualMap.set(repId, (empActualMap.get(repId) || 0) + dealTotal);
      }
    }

    // Per-employee attainment from targets + deal actuals
    const empTargetMap = new Map<string, number>();
    for (const t of targets) {
      empTargetMap.set(t.employee_id, (empTargetMap.get(t.employee_id) || 0) + (t.target_value_usd || 0));
    }

    const attainments: { employeeId: string; pct: number; targetSize: number }[] = [];
    for (const [empId, totalTarget] of empTargetMap) {
      if (totalTarget > 0) {
        const totalActual = empActualMap.get(empId) || 0;
        attainments.push({
          employeeId: empId,
          pct: (totalActual / totalTarget) * 100,
          targetSize: totalTarget,
        });
      }
    }

    // Weighted global quota attainment
    const totalTargetWeight = attainments.reduce((s, a) => s + a.targetSize, 0);
    const globalQuotaAttainment = totalTargetWeight > 0
      ? attainments.reduce((s, a) => s + a.pct * (a.targetSize / totalTargetWeight), 0)
      : 0;

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
    // Add attainment per month (simplified: use overall attainment for employees who had payouts that month)
    for (const p of payouts) {
      const entry = monthMap.get(p.month_year);
      const att = attainments.find((a) => a.employeeId === p.employee_id);
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

    // Per-employee total payouts for top performers
    const empPayoutMap = new Map<string, number>();
    for (const p of payouts) {
      empPayoutMap.set(p.employee_id, (empPayoutMap.get(p.employee_id) || 0) + (p.calculated_amount_usd || 0));
    }

    const topPerformers: TopPerformer[] = Array.from(empPayoutMap.entries())
      .map(([empId, total]) => {
        const emp = employeeMap.get(empId);
        const att = attainments.find((a) => a.employeeId === empId);
        return {
          employeeId: empId,
          fullName: emp?.full_name || "Unknown",
          role: emp?.employee_role || "",
          region: emp?.region || "",
          salesFunction: emp?.sales_function || "",
          totalPayout: total,
          attainmentPct: att?.pct || 0,
        };
      })
      .sort((a, b) => b.totalPayout - a.totalPayout)
      .slice(0, 5);

    return {
      totalPayoutYtd,
      totalPayoutPriorYear,
      yoyChangePct,
      globalQuotaAttainment,
      payoutVsBudgetPct,
      totalBudget,
      activePayees,
      monthlyTrend,
      attainmentDistribution,
      payoutByFunction,
      topPerformers,
    };
  }, [isLoading, currentPayoutsQuery.data, priorPayoutsQuery.data, employeesQuery.data, targetsQuery.data, dealsQuery.data, selectedYear]);

  return { data, isLoading };
}
