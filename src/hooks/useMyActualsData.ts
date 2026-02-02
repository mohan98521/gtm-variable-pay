import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

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

export interface DealRecord {
  id: string;
  project_id: string;
  customer_code: string;
  customer_name: string | null;
  region: string;
  country: string;
  bu: string;
  product: string;
  type_of_proposal: string;
  month_year: string;
  first_year_amc_usd: number | null;
  first_year_subscription_usd: number | null;
  new_software_booking_arr_usd: number | null;
  managed_services_usd: number | null;
  implementation_usd: number | null;
  cr_usd: number | null;
  er_usd: number | null;
  tcv_usd: number | null;
  perpetual_license_usd: number | null;
  gp_margin_percent: number | null;
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
  status: string;
  notes: string | null;
}

export interface ClosingARRRecord {
  id: string;
  month_year: string;
  bu: string;
  product: string;
  pid: string;
  customer_code: string;
  customer_name: string;
  order_category: string | null;
  status: string | null;
  order_category_2: string | null;
  opening_arr: number | null;
  cr: number | null;
  als_others: number | null;
  new: number | null;
  inflation: number | null;
  discount_decrement: number | null;
  churn: number | null;
  adjustment: number | null;
  closing_arr: number | null;
  country: string | null;
  revised_region: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_status: string | null;
  sales_rep_employee_id: string | null;
  sales_rep_name: string | null;
  sales_head_employee_id: string | null;
  sales_head_name: string | null;
  // Calculated fields
  eligible_closing_arr: number;
  is_eligible: boolean;
}

/**
 * Hook to fetch deals where current user is ANY participant (8 roles)
 */
export function useMyDeals(selectedMonth: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["my_deals", selectedYear, selectedMonth],
    queryFn: async () => {
      // Get current user's employee_id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return [];

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;
      const employeeId = profile.employee_id;

      // Build query - fetch ALL deals for the fiscal year
      let query = supabase
        .from("deals")
        .select("*")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .order("month_year", { ascending: false });

      // If specific month selected, filter to that month
      if (selectedMonth) {
        query = query.gte("month_year", `${selectedMonth}-01`).lte("month_year", `${selectedMonth}-31`);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Client-side filter: only include deals where user is ANY participant
      const filteredDeals = (deals || []).filter((deal) => {
        return PARTICIPANT_ROLES.some((role) => deal[role] === employeeId);
      });

      return filteredDeals as DealRecord[];
    },
  });
}

/**
 * Hook to fetch Closing ARR records attributed to current user
 * Includes eligibility calculation (end_date > Dec 31 of fiscal year)
 */
export function useMyClosingARR(selectedMonth: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["my_closing_arr", selectedYear, selectedMonth],
    queryFn: async () => {
      // Get current user's employee_id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return [];

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;
      const employeeId = profile.employee_id;
      const eligibilityCutoff = `${selectedYear}-12-31`;

      // Build query - fetch all closing ARR where user is sales_rep OR sales_head
      let query = supabase
        .from("closing_arr_actuals")
        .select("*")
        .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .order("month_year", { ascending: false });

      // If specific month selected, filter to that month
      if (selectedMonth) {
        query = query.gte("month_year", `${selectedMonth}-01`).lte("month_year", `${selectedMonth}-31`);
      }

      const { data: records, error } = await query;

      if (error) throw error;

      // Add eligibility calculation to each record
      const recordsWithEligibility: ClosingARRRecord[] = (records || []).map((record) => {
        const isEligible = record.end_date ? record.end_date > eligibilityCutoff : false;
        return {
          ...record,
          is_eligible: isEligible,
          eligible_closing_arr: isEligible ? (record.closing_arr || 0) : 0,
        };
      });

      return recordsWithEligibility;
    },
  });
}
