/**
 * Dashboard Payout Run Data Hook
 * 
 * Sources ALL dashboard data from payout runs (payout_metric_details + monthly_payouts + payout_runs).
 * Provides YTD summaries, metric details, commission details, NRR/SPIFF summaries,
 * monthly actuals pivot, and payout run status.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { calculateBlendedProRata, BlendedProRataSegment } from "@/lib/compensation";

export interface PayoutRunStatus {
  runStatus: string; // Draft, Review, Approved, Finalized, Paid
  latestMonth: string;
  monthsCovered: number;
}

export interface AssignmentSegment {
  planName: string;
  startDate: string;
  endDate: string;
  targetBonusUsd: number | null;
  oteUsd: number | null;
  blendedTargetBonusUsd: number | null;
}

export interface MetricSummary {
  metricName: string;
  targetUsd: number;
  actualUsd: number;
  achievementPct: number;
  multiplier: number;
  ytdEligibleUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  allocatedOteUsd: number;
  commissionRatePct: number | null;
  planName: string | null;
  weightagePercent: number;
  logicType: string;
  gateThreshold: number | null;
  // Payout split percentages (derived from booking/collection/yearEnd proportions)
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
  payoutOnYearEndPct: number;
}

export interface CommissionSummary {
  commissionType: string;
  dealValueUsd: number;
  ratePct: number;
  grossPayoutUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
  payoutOnYearEndPct: number;
  minThreshold: number | null;
}

export interface MonthlyActuals {
  month: string;
  monthLabel: string;
  metrics: Record<string, number>; // metric_name -> actual value
}

export interface NRRSummaryData {
  nrrTarget: number;
  nrrActuals: number;
  achievementPct: number;
  payoutUsd: number;
  eligibleCrErUsd: number;
  totalCrErUsd: number;
  eligibleImplUsd: number;
  totalImplUsd: number;
  nrrOtePct: number;
}

export interface SpiffSummaryData {
  totalSpiffUsd: number;
  softwareVariableOteUsd: number;
  softwareTargetUsd: number;
  eligibleActualsUsd: number;
  spiffRatePct: number;
}

export interface DashboardPayoutRunData {
  // Status
  payoutRunStatus: PayoutRunStatus | null;
  
  // YTD Summary
  targetBonusUsd: number;
  totalEligible: number;
  totalPaid: number;
  totalHolding: number;
  totalCommission: number;
  totalVariablePay: number;
  
  // Plan info
  planName: string;
  planId: string | null;
  employeeName: string;
  fiscalYear: number;
  
  // Assignment segments
  assignmentSegments: AssignmentSegment[];
  
  // Metric details (variable_pay)
  vpMetrics: MetricSummary[];
  
  // Commission details
  commissions: CommissionSummary[];
  
  // NRR summary
  nrrSummary: NRRSummaryData | null;
  
  // SPIFF summary
  spiffSummary: SpiffSummaryData | null;
  
  // Monthly actuals pivot
  monthlyActuals: MonthlyActuals[];
  metricNames: string[];
  metricTargets: Record<string, number>;
  
  // Clawback
  clawbackAmount: number;
  
  // Flag
  hasPayoutData: boolean;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function useDashboardPayoutRunData() {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["dashboard_payout_run_data", selectedYear],
    queryFn: async (): Promise<DashboardPayoutRunData | null> => {
      // 1. Get current user & employee
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return null;

      const { data: employee } = await supabase
        .from("employees")
        .select("id, full_name, tvp_usd, sales_function")
        .eq("employee_id", profile.employee_id)
        .maybeSingle();

      if (!employee) return null;

      const employeeUuid = employee.id;

      // 2. Fetch payout runs, metric details, monthly payouts, user_targets, plan_metrics in parallel
      const [
        payoutRunsRes,
        metricDetailsRes,
        monthlyPayoutsRes,
        userTargetsRes,
        clawbackRes,
      ] = await Promise.all([
        // Payout runs for fiscal year
        supabase
          .from("payout_runs")
          .select("id, month_year, run_status")
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`)
          .order("month_year", { ascending: false }),
        
        // All payout metric details for this employee across all runs in the year
        // We need to join through payout_runs to filter by year
        supabase
          .from("payout_runs")
          .select("id, month_year")
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`),
        
        // Monthly payouts for YTD summary
        supabase
          .from("monthly_payouts")
          .select("payout_type, calculated_amount_usd, booking_amount_usd, collection_amount_usd, year_end_amount_usd, clawback_amount_usd, month_year")
          .eq("employee_id", employeeUuid)
          .gte("month_year", `${selectedYear}-01`)
          .lte("month_year", `${selectedYear}-12`),
        
        // User targets for assignment segments
        supabase
          .from("user_targets")
          .select("plan_id, effective_start_date, effective_end_date, target_bonus_usd, ote_usd")
          .eq("user_id", employeeUuid)
          .lte("effective_start_date", `${selectedYear}-12-31`)
          .gte("effective_end_date", `${selectedYear}-01-01`)
          .order("effective_start_date", { ascending: true }),
        
        // Clawback ledger
        supabase
          .from("clawback_ledger")
          .select("original_amount_usd, recovered_amount_usd, status")
          .eq("employee_id", employeeUuid)
          .gte("triggered_month", `${selectedYear}-01`)
          .lte("triggered_month", `${selectedYear}-12`),
      ]);

      const payoutRuns = payoutRunsRes.data || [];
      const monthlyPayouts = monthlyPayoutsRes.data || [];
      const userTargets = userTargetsRes.data || [];

      // Get all payout run IDs for this year to fetch metric details
      const runIds = (metricDetailsRes.data || []).map(r => r.id);
      const runMonthMap = new Map((metricDetailsRes.data || []).map(r => [r.id, r.month_year]));

      // Fetch metric details for all runs
      let allMetricDetails: any[] = [];
      if (runIds.length > 0) {
        const { data: details } = await supabase
          .from("payout_metric_details" as any)
          .select("*")
          .eq("employee_id", employeeUuid)
          .in("payout_run_id", runIds);
        allMetricDetails = (details as any[]) || [];
      }

      // 3. Determine latest payout run status
      let payoutRunStatus: PayoutRunStatus | null = null;
      if (payoutRuns.length > 0) {
        const latest = payoutRuns[0];
        payoutRunStatus = {
          runStatus: latest.run_status,
          latestMonth: latest.month_year,
          monthsCovered: payoutRuns.length,
        };
      }

      // 4. Resolve assignment segments
      let assignmentSegments: AssignmentSegment[] = [];
      if (userTargets.length > 0) {
        const planIds = [...new Set(userTargets.map(t => t.plan_id).filter(Boolean))] as string[];
        const planNameMap = new Map<string, string>();
        if (planIds.length > 0) {
          const { data: plans } = await supabase
            .from("comp_plans")
            .select("id, name")
            .in("id", planIds);
          (plans || []).forEach(p => planNameMap.set(p.id, p.name));
        }

        let blendedTargetBonusUsd: number | null = null;
        if (userTargets.length > 1) {
          const segments: BlendedProRataSegment[] = userTargets.map(t => ({
            targetBonusUsd: t.target_bonus_usd ?? 0,
            startDate: t.effective_start_date,
            endDate: t.effective_end_date,
          }));
          const blendedResult = calculateBlendedProRata(segments, `${selectedYear}-12`, selectedYear);
          blendedTargetBonusUsd = blendedResult.blendedTargetBonusUsd;
        }

        assignmentSegments = userTargets.map(t => ({
          planName: planNameMap.get(t.plan_id) || 'Unknown Plan',
          startDate: t.effective_start_date,
          endDate: t.effective_end_date,
          targetBonusUsd: t.target_bonus_usd,
          oteUsd: t.ote_usd,
          blendedTargetBonusUsd: userTargets.length > 1 ? blendedTargetBonusUsd : null,
        }));
      }

      // 5. Aggregate monthly payouts for YTD summary
      let totalVariablePay = 0;
      let totalCommission = 0;
      let totalPaid = 0;
      let totalHoldingCollection = 0;
      let totalHoldingYearEnd = 0;
      let clawbackTotal = 0;

      for (const p of monthlyPayouts) {
        if (p.payout_type === 'Collection Release' || p.payout_type === 'Year-End Release' || p.payout_type === 'Clawback') {
          if (p.payout_type === 'Clawback') {
            clawbackTotal += Math.abs(p.calculated_amount_usd || 0);
          }
          continue;
        }

        if (p.payout_type === 'Variable Pay') {
          totalVariablePay += p.calculated_amount_usd || 0;
        } else {
          totalCommission += p.calculated_amount_usd || 0;
        }

        totalPaid += p.booking_amount_usd || 0;
        totalHoldingCollection += p.collection_amount_usd || 0;
        totalHoldingYearEnd += p.year_end_amount_usd || 0;
      }

      // Also check clawback ledger
      const clawbackFromLedger = (clawbackRes.data || []).reduce((sum, c) => {
        if (c.status === 'active' || c.status === 'recovering') {
          return sum + (c.original_amount_usd - (c.recovered_amount_usd || 0));
        }
        return sum;
      }, 0);

      const finalClawback = Math.max(clawbackTotal, clawbackFromLedger);

      // 6. Process metric details - use LATEST run per metric for YTD aggregation
      // Group by metric to get the latest snapshot
      const latestByMetric = new Map<string, any>();
      
      // Sort details by run month descending to pick latest
      allMetricDetails.sort((a, b) => {
        const monthA = runMonthMap.get(a.payout_run_id) || '';
        const monthB = runMonthMap.get(b.payout_run_id) || '';
        return monthB.localeCompare(monthA);
      });

      for (const detail of allMetricDetails) {
        const key = `${detail.component_type}:${detail.metric_name}`;
        if (!latestByMetric.has(key)) {
          latestByMetric.set(key, detail);
        }
      }

      // 7. Build VP metric summaries from latest payout metric details
      const vpMetrics: MetricSummary[] = [];
      const commissions: CommissionSummary[] = [];
      let nrrSummary: NRRSummaryData | null = null;
      let spiffSummary: SpiffSummaryData | null = null;

      let planName = "No Plan";
      let planId: string | null = null;

      for (const [key, detail] of latestByMetric) {
        if (detail.plan_name && planName === "No Plan") {
          planName = detail.plan_name;
          planId = detail.plan_id;
        }

        const eligible = detail.ytd_eligible_usd || 0;
        const booking = detail.booking_usd || 0;
        const collection = detail.collection_usd || 0;
        const yearEnd = detail.year_end_usd || 0;
        const total = booking + collection + yearEnd;
        
        // Derive split percentages from actual amounts
        const payoutOnBookingPct = total > 0 ? Math.round((booking / total) * 100) : 70;
        const payoutOnCollectionPct = total > 0 ? Math.round((collection / total) * 100) : 25;
        const payoutOnYearEndPct = total > 0 ? Math.round((yearEnd / total) * 100) : 5;

        if (detail.component_type === 'variable_pay') {
          // Derive weightage from allocation vs target bonus
          const targetBonus = detail.target_bonus_usd || 0;
          const allocated = detail.allocated_ote_usd || 0;
          const weightage = targetBonus > 0 ? Math.round((allocated / targetBonus) * 100) : 0;

          vpMetrics.push({
            metricName: detail.metric_name,
            targetUsd: detail.target_usd || 0,
            actualUsd: detail.actual_usd || 0,
            achievementPct: detail.achievement_pct || 0,
            multiplier: detail.multiplier || 1,
            ytdEligibleUsd: eligible,
            bookingUsd: booking,
            collectionUsd: collection,
            yearEndUsd: yearEnd,
            allocatedOteUsd: allocated,
            commissionRatePct: null,
            planName: detail.plan_name,
            weightagePercent: weightage,
            logicType: detail.notes?.includes('Gated') ? 'Gated_Threshold' : 
                       detail.notes?.includes('Stepped') ? 'Stepped_Accelerator' : 'Linear',
            gateThreshold: null,
            payoutOnBookingPct,
            payoutOnCollectionPct,
            payoutOnYearEndPct,
          });
        } else if (detail.component_type === 'commission') {
          commissions.push({
            commissionType: detail.metric_name,
            dealValueUsd: detail.actual_usd || 0,
            ratePct: detail.commission_rate_pct || 0,
            grossPayoutUsd: eligible,
            bookingUsd: booking,
            collectionUsd: collection,
            yearEndUsd: yearEnd,
            payoutOnBookingPct,
            payoutOnCollectionPct,
            payoutOnYearEndPct,
            minThreshold: null,
          });
        } else if (detail.component_type === 'nrr') {
          // Build NRR summary from the detail
          nrrSummary = {
            nrrTarget: detail.target_usd || 0,
            nrrActuals: detail.actual_usd || 0,
            achievementPct: detail.achievement_pct || 0,
            payoutUsd: eligible,
            eligibleCrErUsd: 0, // We'll approximate from notes if available
            totalCrErUsd: 0,
            eligibleImplUsd: 0,
            totalImplUsd: 0,
            nrrOtePct: 0,
          };
          // Try to extract NRR OTE % from allocated vs target bonus
          if (detail.target_bonus_usd && detail.target_bonus_usd > 0 && detail.allocated_ote_usd) {
            nrrSummary.nrrOtePct = Math.round((detail.allocated_ote_usd / detail.target_bonus_usd) * 100);
          }
        } else if (detail.component_type === 'spiff') {
          spiffSummary = {
            totalSpiffUsd: eligible,
            softwareVariableOteUsd: detail.allocated_ote_usd || 0,
            softwareTargetUsd: detail.target_usd || 0,
            eligibleActualsUsd: detail.actual_usd || 0,
            spiffRatePct: detail.achievement_pct || 0, // SPIFF uses this field for rate
          };
        }
      }

      // Use plan name from assignment segments if available
      if (assignmentSegments.length > 0 && planName === "No Plan") {
        planName = assignmentSegments[assignmentSegments.length - 1].planName;
      }

      // 8. Build monthly actuals pivot
      // Collect all unique metric names (VP + commission)
      const allMetricNames = new Set<string>();
      const monthlyDataMap = new Map<string, Record<string, number>>();
      const metricTargetMap: Record<string, number> = {};

      // Group metric details by month
      for (const detail of allMetricDetails) {
        const runMonth = runMonthMap.get(detail.payout_run_id);
        if (!runMonth) continue;
        
        const monthKey = typeof runMonth === 'string' ? runMonth.substring(0, 7) : String(runMonth).substring(0, 7);
        
        if (detail.component_type === 'variable_pay' || detail.component_type === 'commission') {
          allMetricNames.add(detail.metric_name);
          
          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, {});
          }
          
          // For monthly actuals, use this_month_usd (incremental) for the value
          // For VP metrics this represents actual achievement for that month
          const monthData = monthlyDataMap.get(monthKey)!;
          // Use actual_usd from the run (this is cumulative YTD), 
          // but this_month_usd gives incremental
          monthData[detail.metric_name] = (monthData[detail.metric_name] || 0) + (detail.this_month_usd || 0);
          
          // Targets (use from latest)
          if (detail.target_usd && detail.target_usd > 0) {
            metricTargetMap[detail.metric_name] = detail.target_usd;
          }
        }
      }

      const metricNames = Array.from(allMetricNames).sort();
      
      // Build monthly array for all 12 months
      const monthlyActuals: MonthlyActuals[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${selectedYear}-${m.toString().padStart(2, '0')}`;
        const data = monthlyDataMap.get(monthStr) || {};
        monthlyActuals.push({
          month: monthStr,
          monthLabel: MONTH_LABELS[m - 1],
          metrics: data,
        });
      }

      const targetBonusUsd = employee.tvp_usd || 0;
      const hasPayoutData = allMetricDetails.length > 0 || monthlyPayouts.length > 0;

      return {
        payoutRunStatus,
        targetBonusUsd,
        totalEligible: totalVariablePay + totalCommission,
        totalPaid,
        totalHolding: totalHoldingCollection + totalHoldingYearEnd,
        totalCommission,
        totalVariablePay,
        planName,
        planId,
        employeeName: employee.full_name || profile.full_name || "User",
        fiscalYear: selectedYear,
        assignmentSegments,
        vpMetrics,
        commissions,
        nrrSummary,
        spiffSummary,
        monthlyActuals,
        metricNames,
        metricTargets: metricTargetMap,
        clawbackAmount: finalClawback,
        hasPayoutData,
      };
    },
  });
}
