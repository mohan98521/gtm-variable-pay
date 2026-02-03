import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { DealRecord } from "./useMyActualsData";
import { calculateDealCommission, PlanCommission } from "@/lib/commissions";

// All 8 participant role columns in the deals table
const PARTICIPANT_ROLES = [
  "sales_rep_employee_id",
  "sales_head_employee_id",
  "sales_engineering_employee_id",
  "sales_engineering_head_employee_id",
  "product_specialist_employee_id",
  "product_specialist_head_employee_id",
  "solution_manager_employee_id",
  "solution_manager_head_employee_id",
] as const;

// Roles that can view all data (non-sales roles without targets)
const VIEW_ALL_ROLES = ["admin", "gtm_ops", "finance", "executive"] as const;

/**
 * Get the last day of a month given YYYY-MM format
 */
function getMonthEndDate(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, "0")}`;
}

export interface IncentiveBreakdown {
  type: string;
  value: number;
  rate: number;
  amount: number;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  payout_on_year_end_pct: number;
}

export interface DealWithIncentives extends DealRecord {
  // Collection fields (from deal_collections)
  is_collected: boolean;
  collection_date: string | null;
  collection_month: string | null;
  is_clawback_triggered: boolean;
  first_milestone_due_date: string | null;
  linked_to_impl: boolean;

  // Calculated incentive fields
  eligible_incentive_usd: number;
  payout_on_booking_usd: number;
  payout_on_collection_usd: number;
  payout_on_year_end_usd: number;
  actual_paid_usd: number;

  // Per-category breakdown
  incentive_breakdown: IncentiveBreakdown[];

  // Collection status display
  collection_status: "Pending" | "Collected" | "Clawback" | "Overdue";
}

interface DealCollectionRow {
  deal_id: string;
  is_collected: boolean | null;
  collection_date: string | null;
  collection_month: string | null;
  is_clawback_triggered: boolean | null;
  first_milestone_due_date: string | null;
}

/**
 * Helper to check if user has "view all data" role
 */
async function canUserViewAllData(userId: string): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (userRoles || []).map((r) => r.role);
  return VIEW_ALL_ROLES.some((role) => roles.includes(role));
}

/**
 * Commission type mapping based on deal value columns
 */
const COMMISSION_TYPE_MAPPINGS: { type: string; valueKey: keyof DealRecord }[] = [
  { type: "Managed Services", valueKey: "managed_services_usd" },
  { type: "Perpetual License", valueKey: "perpetual_license_usd" },
  { type: "Implementation", valueKey: "implementation_usd" },
];

/**
 * Calculate CR/ER combined value
 */
function getCrErValue(deal: DealRecord): number {
  return (deal.cr_usd || 0) + (deal.er_usd || 0);
}

/**
 * Calculate incentive breakdown for a deal based on plan commissions
 */
function calculateIncentiveBreakdown(
  deal: DealRecord,
  planCommissions: PlanCommission[],
  linkedToImpl: boolean
): {
  breakdowns: IncentiveBreakdown[];
  totalEligible: number;
  totalBooking: number;
  totalCollection: number;
  totalYearEnd: number;
} {
  const breakdowns: IncentiveBreakdown[] = [];
  let totalEligible = 0;
  let totalBooking = 0;
  let totalCollection = 0;
  let totalYearEnd = 0;

  // Check standard commission types
  for (const mapping of COMMISSION_TYPE_MAPPINGS) {
    const value = deal[mapping.valueKey] as number | null;
    if (value && value > 0) {
      const commission = planCommissions.find(
        (c) => c.commission_type === mapping.type && c.is_active
      );

      if (commission) {
        // Determine payout percentages based on linked_to_impl
        const bookingPct = linkedToImpl ? 0 : (commission.payout_on_booking_pct ?? 70);
        const collectionPct = linkedToImpl ? 100 : (commission.payout_on_collection_pct ?? 25);
        const yearEndPct = linkedToImpl ? 0 : (commission.payout_on_year_end_pct ?? 5);

        const result = calculateDealCommission(
          value,
          commission.commission_rate_pct,
          commission.min_threshold_usd,
          bookingPct,
          collectionPct,
          yearEndPct
        );

        if (result.qualifies) {
          breakdowns.push({
            type: mapping.type,
            value,
            rate: commission.commission_rate_pct,
            amount: result.gross,
            payout_on_booking_pct: bookingPct,
            payout_on_collection_pct: collectionPct,
            payout_on_year_end_pct: yearEndPct,
          });

          totalEligible += result.gross;
          totalBooking += result.paid;
          totalCollection += result.holdback;
          totalYearEnd += result.yearEndHoldback;
        }
      }
    }
  }

  // Check CR/ER combined
  const crErValue = getCrErValue(deal);
  if (crErValue > 0) {
    const commission = planCommissions.find(
      (c) => c.commission_type === "CR/ER" && c.is_active
    );

    if (commission) {
      const bookingPct = linkedToImpl ? 0 : (commission.payout_on_booking_pct ?? 70);
      const collectionPct = linkedToImpl ? 100 : (commission.payout_on_collection_pct ?? 25);
      const yearEndPct = linkedToImpl ? 0 : (commission.payout_on_year_end_pct ?? 5);

      const result = calculateDealCommission(
        crErValue,
        commission.commission_rate_pct,
        commission.min_threshold_usd,
        bookingPct,
        collectionPct,
        yearEndPct
      );

      if (result.qualifies) {
        breakdowns.push({
          type: "CR/ER",
          value: crErValue,
          rate: commission.commission_rate_pct,
          amount: result.gross,
          payout_on_booking_pct: bookingPct,
          payout_on_collection_pct: collectionPct,
          payout_on_year_end_pct: yearEndPct,
        });

        totalEligible += result.gross;
        totalBooking += result.paid;
        totalCollection += result.holdback;
        totalYearEnd += result.yearEndHoldback;
      }
    }
  }

  return {
    breakdowns,
    totalEligible,
    totalBooking,
    totalCollection,
    totalYearEnd,
  };
}

/**
 * Determine collection status based on collection data and clawback
 */
function getCollectionStatus(
  isCollected: boolean,
  isClawback: boolean,
  firstMilestoneDueDate: string | null
): "Pending" | "Collected" | "Clawback" | "Overdue" {
  if (isClawback) return "Clawback";
  if (isCollected) return "Collected";
  
  // Check if overdue
  if (firstMilestoneDueDate) {
    const dueDate = new Date(firstMilestoneDueDate);
    const today = new Date();
    if (dueDate < today) return "Overdue";
  }
  
  return "Pending";
}

/**
 * Hook to fetch deals with collection status and calculated incentives
 */
export function useMyDealsWithIncentives(selectedMonth: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["my_deals_with_incentives", selectedYear, selectedMonth],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // Check if user can view all data
      const canViewAll = await canUserViewAllData(user.id);

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;

      // Build deal query
      let dealsQuery = supabase
        .from("deals")
        .select("*")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .order("month_year", { ascending: false });

      // If specific month selected, filter to that month
      if (selectedMonth) {
        const startDate = `${selectedMonth}-01`;
        const endDate = getMonthEndDate(selectedMonth);
        dealsQuery = dealsQuery.gte("month_year", startDate).lte("month_year", endDate);
      }

      const { data: deals, error: dealsError } = await dealsQuery;
      if (dealsError) throw dealsError;

      // Get user's employee_id for filtering if not admin
      let employeeId: string | null = null;
      if (!canViewAll) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.employee_id) return [];
        employeeId = profile.employee_id;
      }

      // Filter deals for non-admin users
      let filteredDeals = deals || [];
      if (!canViewAll && employeeId) {
        filteredDeals = filteredDeals.filter((deal) => {
          return PARTICIPANT_ROLES.some((role) => deal[role] === employeeId);
        });
      }

      if (filteredDeals.length === 0) return [];

      // Fetch deal_collections for all relevant deals
      const dealIds = filteredDeals.map((d) => d.id);
      const { data: collections } = await supabase
        .from("deal_collections")
        .select("deal_id, is_collected, collection_date, collection_month, is_clawback_triggered, first_milestone_due_date")
        .in("deal_id", dealIds);

      // Create a map of deal_id to collection data
      const collectionsMap = new Map<string, DealCollectionRow>();
      (collections || []).forEach((c) => {
        collectionsMap.set(c.deal_id, c);
      });

      // Fetch plan commissions - get all active plan commissions
      // We'll use the first active plan's commissions for now (can be enhanced to use user's assigned plan)
      const { data: planCommissions } = await supabase
        .from("plan_commissions")
        .select("*")
        .eq("is_active", true);

      const commissionsList: PlanCommission[] = (planCommissions || []).map((pc) => ({
        commission_type: pc.commission_type,
        commission_rate_pct: pc.commission_rate_pct,
        min_threshold_usd: pc.min_threshold_usd,
        is_active: pc.is_active ?? true,
        payout_on_booking_pct: pc.payout_on_booking_pct ?? 70,
        payout_on_collection_pct: pc.payout_on_collection_pct ?? 25,
        payout_on_year_end_pct: pc.payout_on_year_end_pct ?? 5,
      }));

      // Enhance each deal with collection and incentive data
      const dealsWithIncentives: DealWithIncentives[] = filteredDeals.map((deal) => {
        const collection = collectionsMap.get(deal.id);
        const linkedToImpl = deal.linked_to_impl || false;
        const isCollected = collection?.is_collected ?? false;
        const isClawback = collection?.is_clawback_triggered ?? false;

        // Calculate incentive breakdown
        const incentiveCalc = calculateIncentiveBreakdown(
          deal as DealRecord,
          commissionsList,
          linkedToImpl
        );

        // Calculate actual paid based on collection status
        let actualPaid = incentiveCalc.totalBooking; // Always get booking portion
        if (isCollected) {
          actualPaid += incentiveCalc.totalCollection; // Add collection portion if collected
        }
        if (isClawback) {
          actualPaid = 0; // Clawback means no payout
        }

        const collectionStatus = getCollectionStatus(
          isCollected,
          isClawback,
          collection?.first_milestone_due_date ?? null
        );

        return {
          ...(deal as DealRecord),
          // Collection fields
          is_collected: isCollected,
          collection_date: collection?.collection_date ?? null,
          collection_month: collection?.collection_month ?? null,
          is_clawback_triggered: isClawback,
          first_milestone_due_date: collection?.first_milestone_due_date ?? null,
          linked_to_impl: linkedToImpl,
          collection_status: collectionStatus,

          // Calculated incentive fields
          eligible_incentive_usd: Math.round(incentiveCalc.totalEligible * 100) / 100,
          payout_on_booking_usd: Math.round(incentiveCalc.totalBooking * 100) / 100,
          payout_on_collection_usd: Math.round(incentiveCalc.totalCollection * 100) / 100,
          payout_on_year_end_usd: Math.round(incentiveCalc.totalYearEnd * 100) / 100,
          actual_paid_usd: Math.round(actualPaid * 100) / 100,

          // Breakdown
          incentive_breakdown: incentiveCalc.breakdowns,
        };
      });

      return dealsWithIncentives;
    },
  });
}
