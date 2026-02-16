/**
 * Dashboard Payout Run Data Hook
 * 
 * Sources ALL dashboard data from payout runs (payout_metric_details + monthly_payouts + payout_runs).
 * Also fetches full plan configuration to ensure ALL metrics are visible even without actuals.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { calculateBlendedProRata, BlendedProRataSegment } from "@/lib/compensation";
import { NRR_DISPLAY_NAME } from "@/lib/payoutTypes";

export interface PayoutRunStatus {
  runStatus: string;
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
  metrics: Record<string, number>;
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
  achievementPct: number;
}

export interface PlanConfig {
  planId: string;
  planName: string;
  metrics: Array<{
    metricName: string;
    weightagePercent: number;
    logicType: string;
    gateThresholdPercent: number | null;
    payoutOnBookingPct: number;
    payoutOnCollectionPct: number;
    payoutOnYearEndPct: number;
    multiplierGrids: Array<{ min_pct: number; max_pct: number; multiplier_value: number }>;
  }>;
  commissions: Array<{
    commissionType: string;
    ratePct: number;
    minThresholdUsd: number | null;
    payoutOnBookingPct: number;
    payoutOnCollectionPct: number;
    payoutOnYearEndPct: number;
  }>;
  spiffs: Array<{
    spiffName: string;
    spiffRatePct: number;
    minDealValueUsd: number;
    linkedMetricName: string;
  }>;
  nrrOtePct: number;
  nrrPayoutOnBookingPct: number;
  nrrPayoutOnCollectionPct: number;
  nrrPayoutOnYearEndPct: number;
}

export interface DashboardPayoutRunData {
  payoutRunStatus: PayoutRunStatus | null;
  
  // YTD Summary - bifurcated
  targetBonusUsd: number;
  ytdTotalEligible: number;
  ytdBookingUsd: number;
  ytdCollectionUsd: number;
  ytdYearEndUsd: number;
  
  // Legacy fields for backwards compat
  totalEligible: number;
  totalPaid: number;
  totalHolding: number;
  totalCommission: number;
  totalVariablePay: number;
  
  planName: string;
  planId: string | null;
  employeeName: string;
  fiscalYear: number;
  
  assignmentSegments: AssignmentSegment[];
  vpMetrics: MetricSummary[];
  commissions: CommissionSummary[];
  nrrSummary: NRRSummaryData | null;
  spiffSummary: SpiffSummaryData | null;
  
  monthlyActuals: MonthlyActuals[];
  metricNames: string[];
  metricTargets: Record<string, number>;
  
  clawbackAmount: number;
  hasPayoutData: boolean;
  
  // Full plan config for simulator
  planConfig: PlanConfig | null;
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

      // 2. Fetch payout runs, metric details, monthly payouts, user_targets, clawback, performance_targets, deals in parallel
      const [
        payoutRunsRes,
        metricDetailsRes,
        monthlyPayoutsRes,
        userTargetsRes,
        clawbackRes,
        perfTargetsRes,
        dealsRes,
        closingArrRes,
      ] = await Promise.all([
        supabase
          .from("payout_runs")
          .select("id, month_year, run_status")
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`)
          .order("month_year", { ascending: false }),
        
        supabase
          .from("payout_runs")
          .select("id, month_year")
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`),
        
        supabase
          .from("monthly_payouts")
          .select("payout_type, calculated_amount_usd, booking_amount_usd, collection_amount_usd, year_end_amount_usd, clawback_amount_usd, month_year")
          .eq("employee_id", employeeUuid)
          .gte("month_year", `${selectedYear}-01`)
          .lte("month_year", `${selectedYear}-12`),
        
        supabase
          .from("user_targets")
          .select("plan_id, effective_start_date, effective_end_date, target_bonus_usd, ote_usd")
          .eq("user_id", employeeUuid)
          .lte("effective_start_date", `${selectedYear}-12-31`)
          .gte("effective_end_date", `${selectedYear}-01-01`)
          .order("effective_start_date", { ascending: true }),
        
        supabase
          .from("clawback_ledger")
          .select("original_amount_usd, recovered_amount_usd, status")
          .eq("employee_id", employeeUuid)
          .gte("triggered_month", `${selectedYear}-01`)
          .lte("triggered_month", `${selectedYear}-12`),

        // Fetch performance_targets for this employee (Issue 1: correct targets)
        supabase
          .from("performance_targets")
          .select("metric_type, target_value_usd")
          .eq("employee_id", profile.employee_id)
          .eq("effective_year", selectedYear),

        // Fetch deals for monthly actuals pivot (Issue 3: deal values not payouts)
        supabase
          .from("deals")
          .select("month_year, new_software_booking_arr_usd, managed_services_usd, cr_usd, er_usd, implementation_usd, perpetual_license_usd, sales_rep_employee_id")
          .eq("sales_rep_employee_id", profile.employee_id)
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`),

        // Fetch closing ARR actuals for monthly snapshots (Issue 3)
        supabase
          .from("closing_arr_actuals")
          .select("month_year, closing_arr")
          .eq("sales_rep_employee_id", profile.employee_id)
          .gte("month_year", `${selectedYear}-01-01`)
          .lte("month_year", `${selectedYear}-12-31`),
      ]);

      const payoutRuns = payoutRunsRes.data || [];
      const monthlyPayouts = monthlyPayoutsRes.data || [];
      const userTargets = userTargetsRes.data || [];
      const perfTargets = perfTargetsRes.data || [];
      const deals = dealsRes.data || [];
      const closingArrActuals = closingArrRes.data || [];

      // Build performance targets lookup map (metric_type -> annual target)
      const perfTargetMap = new Map<string, number>();
      for (const pt of perfTargets) {
        perfTargetMap.set(pt.metric_type, pt.target_value_usd);
      }

      const runIds = (metricDetailsRes.data || []).map(r => r.id);
      const runMonthMap = new Map((metricDetailsRes.data || []).map(r => [r.id, r.month_year]));

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

      // 5. Aggregate monthly payouts for YTD summary - bifurcated
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

      const clawbackFromLedger = (clawbackRes.data || []).reduce((sum, c) => {
        if (c.status === 'active' || c.status === 'recovering') {
          return sum + (c.original_amount_usd - (c.recovered_amount_usd || 0));
        }
        return sum;
      }, 0);

      const finalClawback = Math.max(clawbackTotal, clawbackFromLedger);

      // 6. Process metric details - use LATEST run per metric for YTD aggregation
      const latestByMetric = new Map<string, any>();
      
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

      // 7. Build VP metric summaries, commissions, NRR, SPIFF from latest payout metric details
      const vpMetrics: MetricSummary[] = [];
      const commissions: CommissionSummary[] = [];
      let nrrSummary: NRRSummaryData | null = null;
      let spiffSummary: SpiffSummaryData | null = null;

      let planName = "No Plan";
      let planId: string | null = null;

      // Track which metrics/commissions we've seen from payout data
      const seenVpMetrics = new Set<string>();
      const seenCommissions = new Set<string>();
      let seenNrr = false;
      let seenSpiff = false;

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
        
        const payoutOnBookingPct = total > 0 ? Math.round((booking / total) * 100) : 70;
        const payoutOnCollectionPct = total > 0 ? Math.round((collection / total) * 100) : 25;
        const payoutOnYearEndPct = total > 0 ? Math.round((yearEnd / total) * 100) : 5;

        if (detail.component_type === 'variable_pay') {
          seenVpMetrics.add(detail.metric_name);
          const targetBonus = detail.target_bonus_usd || 0;
          const allocated = detail.allocated_ote_usd || 0;
          const weightage = targetBonus > 0 ? Math.round((allocated / targetBonus) * 100) : 0;

          // Use performance_targets for target if available (Issue 1)
          const targetFromPerfTargets = perfTargetMap.get(detail.metric_name);
          const targetUsd = targetFromPerfTargets ?? (detail.target_usd || 0);

          vpMetrics.push({
            metricName: detail.metric_name,
            targetUsd,
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
            // Will be cross-referenced with planConfig below (Issue 2)
            logicType: 'Linear',
            gateThreshold: null,
            payoutOnBookingPct,
            payoutOnCollectionPct,
            payoutOnYearEndPct,
          });
        } else if (detail.component_type === 'commission') {
          seenCommissions.add(detail.metric_name);
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
          seenNrr = true;
          nrrSummary = {
            nrrTarget: detail.target_usd || 0,
            nrrActuals: detail.actual_usd || 0,
            achievementPct: detail.achievement_pct || 0,
            payoutUsd: eligible,
            eligibleCrErUsd: 0,
            totalCrErUsd: 0,
            eligibleImplUsd: 0,
            totalImplUsd: 0,
            nrrOtePct: 0,
          };
          if (detail.target_bonus_usd && detail.target_bonus_usd > 0 && detail.allocated_ote_usd) {
            nrrSummary.nrrOtePct = Math.round((detail.allocated_ote_usd / detail.target_bonus_usd) * 100);
          }
        } else if (detail.component_type === 'spiff') {
          seenSpiff = true;
          spiffSummary = {
            totalSpiffUsd: eligible,
            softwareVariableOteUsd: detail.allocated_ote_usd || 0,
            softwareTargetUsd: detail.target_usd || 0,
            eligibleActualsUsd: detail.actual_usd || 0,
            spiffRatePct: 0, // Will be filled from plan config
            achievementPct: detail.achievement_pct || 0,
          };
        }
      }

      // Use plan name from assignment segments if available
      if (assignmentSegments.length > 0 && planName === "No Plan") {
        planName = assignmentSegments[assignmentSegments.length - 1].planName;
      }

      // 8. Fetch full plan configuration for simulator and to fill gaps
      let planConfig: PlanConfig | null = null;
      
      // Resolve planId from user_targets if not found from metric details
      if (!planId && userTargets.length > 0) {
        planId = userTargets[userTargets.length - 1].plan_id;
      }
      
      if (planId) {
        const [planRes, metricsRes, commissionsRes, spiffsRes] = await Promise.all([
          supabase
            .from("comp_plans")
            .select("id, name, nrr_ote_percent, nrr_payout_on_booking_pct, nrr_payout_on_collection_pct, nrr_payout_on_year_end_pct")
            .eq("id", planId)
            .maybeSingle(),
          supabase
            .from("plan_metrics")
            .select("id, metric_name, weightage_percent, logic_type, gate_threshold_percent, payout_on_booking_pct, payout_on_collection_pct, payout_on_year_end_pct")
            .eq("plan_id", planId)
            .order("metric_name"),
          supabase
            .from("plan_commissions")
            .select("commission_type, commission_rate_pct, min_threshold_usd, payout_on_booking_pct, payout_on_collection_pct, payout_on_year_end_pct")
            .eq("plan_id", planId)
            .eq("is_active", true),
          supabase
            .from("plan_spiffs")
            .select("spiff_name, spiff_rate_pct, min_deal_value_usd, linked_metric_name, payout_on_booking_pct, payout_on_collection_pct, payout_on_year_end_pct")
            .eq("plan_id", planId)
            .eq("is_active", true),
        ]);

        const planData = planRes.data;
        const planMetrics = metricsRes.data || [];
        const planCommissions = commissionsRes.data || [];
        const planSpiffs = spiffsRes.data || [];

        // Fetch multiplier grids for all plan metrics
        const metricIds = planMetrics.map(m => m.id);
        let multiplierGrids: any[] = [];
        if (metricIds.length > 0) {
          const { data: grids } = await supabase
            .from("multiplier_grids")
            .select("plan_metric_id, min_pct, max_pct, multiplier_value")
            .in("plan_metric_id", metricIds)
            .order("min_pct");
          multiplierGrids = grids || [];
        }

        planConfig = {
          planId,
          planName: planData?.name || planName,
          metrics: planMetrics.map(m => ({
            metricName: m.metric_name,
            weightagePercent: m.weightage_percent,
            logicType: m.logic_type,
            gateThresholdPercent: m.gate_threshold_percent,
            payoutOnBookingPct: m.payout_on_booking_pct ?? 70,
            payoutOnCollectionPct: m.payout_on_collection_pct ?? 25,
            payoutOnYearEndPct: m.payout_on_year_end_pct ?? 5,
            multiplierGrids: multiplierGrids
              .filter(g => g.plan_metric_id === m.id)
              .map(g => ({ min_pct: g.min_pct, max_pct: g.max_pct, multiplier_value: g.multiplier_value })),
          })),
          commissions: planCommissions.map(c => ({
            commissionType: c.commission_type,
            ratePct: c.commission_rate_pct,
            minThresholdUsd: c.min_threshold_usd,
            payoutOnBookingPct: c.payout_on_booking_pct ?? 75,
            payoutOnCollectionPct: c.payout_on_collection_pct ?? 25,
            payoutOnYearEndPct: c.payout_on_year_end_pct ?? 0,
          })),
          spiffs: planSpiffs.map(s => ({
            spiffName: s.spiff_name,
            spiffRatePct: s.spiff_rate_pct,
            minDealValueUsd: s.min_deal_value_usd ?? 0,
            linkedMetricName: s.linked_metric_name || '',
          })),
          nrrOtePct: planData?.nrr_ote_percent || 0,
          nrrPayoutOnBookingPct: planData?.nrr_payout_on_booking_pct ?? 0,
          nrrPayoutOnCollectionPct: planData?.nrr_payout_on_collection_pct ?? 100,
          nrrPayoutOnYearEndPct: planData?.nrr_payout_on_year_end_pct ?? 0,
        };

        // Fix SPIFF rate from plan config
        if (spiffSummary && planConfig.spiffs.length > 0) {
          spiffSummary.spiffRatePct = planConfig.spiffs[0].spiffRatePct;
        }

        // Fix NRR OTE % from plan config
        if (nrrSummary && planConfig.nrrOtePct > 0) {
          nrrSummary.nrrOtePct = planConfig.nrrOtePct;
        }

        // Issue 2: Cross-reference ALL VP metrics with planConfig for correct logicType, weightage, gateThreshold
        for (const vp of vpMetrics) {
          const configMetric = planConfig.metrics.find(m => m.metricName === vp.metricName);
          if (configMetric) {
            vp.logicType = configMetric.logicType;
            vp.gateThreshold = configMetric.gateThresholdPercent;
            vp.weightagePercent = configMetric.weightagePercent;
            vp.payoutOnBookingPct = configMetric.payoutOnBookingPct;
            vp.payoutOnCollectionPct = configMetric.payoutOnCollectionPct;
            vp.payoutOnYearEndPct = configMetric.payoutOnYearEndPct;
          }
        }

        // Fill missing VP metrics from plan config (zero actuals)
        for (const pm of planConfig.metrics) {
          if (!seenVpMetrics.has(pm.metricName)) {
            const targetBonusUsd = employee.tvp_usd || 0;
            const allocated = (targetBonusUsd * pm.weightagePercent) / 100;
            // Issue 1: Use performance_targets for target value
            const targetFromPerfTargets = perfTargetMap.get(pm.metricName);
            vpMetrics.push({
              metricName: pm.metricName,
              targetUsd: targetFromPerfTargets ?? 0,
              actualUsd: 0,
              achievementPct: 0,
              multiplier: 1,
              ytdEligibleUsd: 0,
              bookingUsd: 0,
              collectionUsd: 0,
              yearEndUsd: 0,
              allocatedOteUsd: allocated,
              commissionRatePct: null,
              planName,
              weightagePercent: pm.weightagePercent,
              logicType: pm.logicType,
              gateThreshold: pm.gateThresholdPercent,
              payoutOnBookingPct: pm.payoutOnBookingPct,
              payoutOnCollectionPct: pm.payoutOnCollectionPct,
              payoutOnYearEndPct: pm.payoutOnYearEndPct,
            });
          }
        }

        // Fill missing commissions from plan config (zero actuals)
        for (const pc of planConfig.commissions) {
          if (!seenCommissions.has(pc.commissionType)) {
            commissions.push({
              commissionType: pc.commissionType,
              dealValueUsd: 0,
              ratePct: pc.ratePct,
              grossPayoutUsd: 0,
              bookingUsd: 0,
              collectionUsd: 0,
              yearEndUsd: 0,
              payoutOnBookingPct: pc.payoutOnBookingPct,
              payoutOnCollectionPct: pc.payoutOnCollectionPct,
              payoutOnYearEndPct: pc.payoutOnYearEndPct,
              minThreshold: pc.minThresholdUsd,
            });
          }
        }

        // Fill NRR if not seen but plan has nrr_ote_percent > 0
        if (!seenNrr && planConfig.nrrOtePct > 0) {
          nrrSummary = {
            nrrTarget: 0,
            nrrActuals: 0,
            achievementPct: 0,
            payoutUsd: 0,
            eligibleCrErUsd: 0,
            totalCrErUsd: 0,
            eligibleImplUsd: 0,
            totalImplUsd: 0,
            nrrOtePct: planConfig.nrrOtePct,
          };
        }

        // Fill SPIFF if not seen but plan has spiffs
        if (!seenSpiff && planConfig.spiffs.length > 0) {
          spiffSummary = {
            totalSpiffUsd: 0,
            softwareVariableOteUsd: 0,
            softwareTargetUsd: 0,
            eligibleActualsUsd: 0,
            spiffRatePct: planConfig.spiffs[0].spiffRatePct,
            achievementPct: 0,
          };
        }
      }

      // 9. Build monthly actuals pivot from DEALS (deal values, not payout values) - Issue 3
      const allMetricNames = new Set<string>();
      const monthlyDataMap = new Map<string, Record<string, number>>();
      const metricTargetMap: Record<string, number> = {};

      // Populate from deals table (actual deal values)
      for (const deal of deals) {
        const monthKey = deal.month_year?.substring(0, 7);
        if (!monthKey) continue;

        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, {});
        }
        const monthData = monthlyDataMap.get(monthKey)!;

        // Map deal columns to metric names matching plan_metrics/plan_commissions
        if (deal.new_software_booking_arr_usd) {
          const name = "New Software Booking ARR";
          allMetricNames.add(name);
          monthData[name] = (monthData[name] || 0) + deal.new_software_booking_arr_usd;
        }
        if (deal.managed_services_usd) {
          const name = "Managed Services";
          allMetricNames.add(name);
          monthData[name] = (monthData[name] || 0) + deal.managed_services_usd;
        }
        if ((deal.cr_usd || 0) + (deal.er_usd || 0) > 0) {
          const name = "CR/ER";
          allMetricNames.add(name);
          monthData[name] = (monthData[name] || 0) + (deal.cr_usd || 0) + (deal.er_usd || 0);
        }
        if (deal.implementation_usd) {
          const name = "Implementation";
          allMetricNames.add(name);
          monthData[name] = (monthData[name] || 0) + deal.implementation_usd;
        }
        if (deal.perpetual_license_usd) {
          const name = "Perpetual License";
          allMetricNames.add(name);
          monthData[name] = (monthData[name] || 0) + deal.perpetual_license_usd;
        }
      }

      // Add Closing ARR monthly snapshots
      for (const arr of closingArrActuals) {
        const monthKey = arr.month_year?.substring(0, 7);
        if (!monthKey || !arr.closing_arr) continue;

        const name = "Closing ARR";
        allMetricNames.add(name);
        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, {});
        }
        const monthData = monthlyDataMap.get(monthKey)!;
        monthData[name] = (monthData[name] || 0) + arr.closing_arr;
      }

      // Add NRR / SPIFF from payout_metric_details — show deal values (incremental actuals), not payout amounts
      // Sort by run month first so incremental calculation from cumulative actual_usd is accurate
      const nrrSpiffDetails = allMetricDetails
        .filter(d => d.component_type === 'nrr' || d.component_type === 'spiff')
        .sort((a, b) => {
          const mA = runMonthMap.get(a.payout_run_id) || '';
          const mB = runMonthMap.get(b.payout_run_id) || '';
          return String(mA).localeCompare(String(mB));
        });

      // Track prior month cumulative actual per metric to derive monthly incremental
      const priorCumulativeMap = new Map<string, number>();

      for (const detail of nrrSpiffDetails) {
        const runMonth = runMonthMap.get(detail.payout_run_id);
        if (!runMonth) continue;
        const monthKey = typeof runMonth === 'string' ? runMonth.substring(0, 7) : String(runMonth).substring(0, 7);
        // Normalize metric names to match display labels (avoid duplicate columns)
        let metricName = detail.metric_name;
        if (detail.component_type === 'spiff' && planConfig?.spiffs?.length) {
          metricName = planConfig.spiffs[0].spiffName || "Large Deal SPIFF";
        } else if (detail.component_type === 'nrr') {
          metricName = NRR_DISPLAY_NAME;
        }
        allMetricNames.add(metricName);

        // actual_usd is YTD cumulative; derive incremental for this month
        const currentCumulative = detail.actual_usd || 0;
        const priorCumulative = priorCumulativeMap.get(metricName) || 0;
        const incrementalActual = currentCumulative - priorCumulative;
        priorCumulativeMap.set(metricName, currentCumulative);

        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, {});
        }
        const monthData = monthlyDataMap.get(monthKey)!;
        monthData[metricName] = (monthData[metricName] || 0) + Math.max(0, incrementalActual);
      }

      // Populate metricTargetMap from performance_targets (Issue 1)
      for (const [metricType, targetVal] of perfTargetMap) {
        metricTargetMap[metricType] = targetVal;
      }
      // Also fill from payout_metric_details for metrics not in performance_targets
      for (const detail of allMetricDetails) {
        let tMetricName = detail.metric_name;
        if (detail.component_type === 'spiff' && planConfig?.spiffs?.length) {
          tMetricName = planConfig.spiffs[0].spiffName || "Large Deal SPIFF";
        }
        if (detail.target_usd && detail.target_usd > 0 && !metricTargetMap[tMetricName]) {
          metricTargetMap[tMetricName] = detail.target_usd;
        }
      }

      // Also add metrics from plan config that might not have actuals yet
      if (planConfig) {
        for (const pm of planConfig.metrics) {
          allMetricNames.add(pm.metricName);
        }
        for (const pc of planConfig.commissions) {
          allMetricNames.add(pc.commissionType);
        }
        if (planConfig.nrrOtePct > 0) {
          allMetricNames.add(NRR_DISPLAY_NAME);
        }
        if (planConfig.spiffs.length > 0) {
          for (const s of planConfig.spiffs) {
            allMetricNames.add(s.spiffName || "Large Deal SPIFF");
          }
        }
      }

      const METRIC_PRIORITY: Record<string, number> = {
        "New Software Booking ARR": 1,
        "Closing ARR": 2,
        [NRR_DISPLAY_NAME]: 3,
        "Large Deal SPIFF": 4,
      };
      const metricNames = Array.from(allMetricNames).sort((a, b) => {
        const pa = METRIC_PRIORITY[a] ?? 999;
        const pb = METRIC_PRIORITY[b] ?? 999;
        if (pa !== pb) return pa - pb;
        return a.localeCompare(b);
      });
      
      // Only build months that have data (Issue 3: don't show all 12 months)
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

      // Calculate bifurcated YTD totals from all metric details
      let ytdTotalEligible = 0;
      let ytdBookingUsd = 0;
      let ytdCollectionUsd = 0;
      let ytdYearEndUsd = 0;

      for (const m of vpMetrics) {
        ytdTotalEligible += m.ytdEligibleUsd;
        ytdBookingUsd += m.bookingUsd;
        ytdCollectionUsd += m.collectionUsd;
        ytdYearEndUsd += m.yearEndUsd;
      }
      for (const c of commissions) {
        ytdTotalEligible += c.grossPayoutUsd;
        ytdBookingUsd += c.bookingUsd;
        ytdCollectionUsd += c.collectionUsd;
        ytdYearEndUsd += c.yearEndUsd;
      }
      if (nrrSummary) {
        ytdTotalEligible += nrrSummary.payoutUsd;
      }
      if (spiffSummary) {
        ytdTotalEligible += spiffSummary.totalSpiffUsd;
      }

      return {
        payoutRunStatus,
        targetBonusUsd,
        ytdTotalEligible,
        ytdBookingUsd,
        ytdCollectionUsd,
        ytdYearEndUsd,
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
        planConfig,
      };
    },
  });
}
