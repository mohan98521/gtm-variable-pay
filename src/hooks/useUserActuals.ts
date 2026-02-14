import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

// All participant role columns in the deals table
const PARTICIPANT_ROLES = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
  'solution_architect_employee_id',
] as const;

/**
 * Get deal IDs where employee is credited via support team membership
 */
async function getTeamDealIds(employeeId: string, yearStart: string, yearEnd: string): Promise<string[]> {
  const { data: memberships } = await supabase
    .from('support_team_members' as any)
    .select('team_id')
    .eq('employee_id', employeeId)
    .eq('is_active', true);

  if (!memberships || memberships.length === 0) return [];

  const teamIds = (memberships as any[]).map((m: any) => m.team_id);
  const orParts = teamIds.flatMap((tid: string) => [
    `sales_engineering_team_id.eq.${tid}`,
    `solution_manager_team_id.eq.${tid}`,
  ]);

  const { data: deals } = await supabase
    .from('deals')
    .select('id')
    .or(orParts.join(','))
    .gte('month_year', yearStart)
    .lte('month_year', yearEnd);

  return (deals || []).map(d => d.id);
}

export interface MonthlyActual {
  month: string;
  value: number;
}

export interface MetricActuals {
  metricName: string;
  monthlyActuals: MonthlyActual[];
  ytdTotal: number;
}

export interface UserActualsResult {
  actuals: MetricActuals[];
  isLoading: boolean;
  error: Error | null;
}

interface DealRow {
  month_year: string;
  new_software_booking_arr_usd: number | null;
  sales_rep_employee_id: string | null;
  sales_head_employee_id: string | null;
  sales_engineering_employee_id: string | null;
  sales_engineering_head_employee_id: string | null;
  product_specialist_employee_id: string | null;
  product_specialist_head_employee_id: string | null;
  solution_manager_employee_id: string | null;
  solution_manager_head_employee_id: string | null;
  solution_architect_employee_id: string | null;
}

/**
 * Fetch real actuals for the current user from deals and closing_arr_actuals tables
 * Aggregates by metric type and month for dashboard display
 * Supports multi-participant attribution - credits all 8 participant roles
 */
export function useUserActuals() {
  const { selectedYear } = useFiscalYear();
  
  return useQuery({
    queryKey: ["user_actuals", selectedYear],
    queryFn: async () => {
      // Get current user's profile with employee_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { actuals: [] };

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return { actuals: [] };

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;
      const employeeId = profile.employee_id;
      
      // Fetch ALL deals with all participant role columns
      // We need to check if current user is ANY participant
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select(`
          id,
          month_year,
          new_software_booking_arr_usd,
          sales_rep_employee_id,
          sales_head_employee_id,
          sales_engineering_employee_id,
          sales_engineering_head_employee_id,
          product_specialist_employee_id,
          product_specialist_head_employee_id,
          solution_manager_employee_id,
          solution_manager_head_employee_id,
          solution_architect_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      if (dealsError) throw dealsError;

      // Filter deals where current employee is ANY participant (direct or via team)
      const teamDealIds = await getTeamDealIds(employeeId, fiscalYearStart, fiscalYearEnd);
      const teamDealIdSet = new Set(teamDealIds);
      
      const newBookingByMonth = new Map<string, number>();
      (deals || []).forEach((deal: DealRow) => {
        const isDirectParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
        const isTeamParticipant = teamDealIdSet.has((deal as any).id);
        
        if (isDirectParticipant || isTeamParticipant) {
          const monthKey = deal.month_year?.substring(0, 7) || "";
          const current = newBookingByMonth.get(monthKey) || 0;
          newBookingByMonth.set(monthKey, current + (deal.new_software_booking_arr_usd || 0));
        }
      });

      // Fetch ELIGIBLE closing ARR actuals (only records with end_date > fiscal year end)
      // Attribution: Both sales_rep and sales_head receive credit
      const { data: closingArr, error: closingError } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr, end_date, sales_rep_employee_id, sales_head_employee_id, is_multi_year, renewal_years")
        .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .gt("end_date", `${selectedYear}-12-31`); // ELIGIBILITY FILTER

      if (closingError) throw closingError;

      // Aggregate Eligible Closing ARR by month
      // Note: renewal multipliers are NOT applied here in dashboard display
      // They are only applied in the payout engine for compensation calculation
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach((arr: any) => {
        const monthKey = arr.month_year?.substring(0, 7) || "";
        const current = closingByMonth.get(monthKey) || 0;
        closingByMonth.set(monthKey, current + (arr.closing_arr || 0));
      });

      // Build monthly actuals arrays
      const newBookingMonthly: MonthlyActual[] = Array.from(newBookingByMonth.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const closingMonthly: MonthlyActual[] = Array.from(closingByMonth.entries())
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // New Software Booking ARR is cumulative (sum all months)
      const newBookingYtd = newBookingMonthly.reduce((sum, m) => sum + m.value, 0);
      
      // Closing ARR uses LATEST month only (not cumulative - uploads are portfolio snapshots)
      const sortedClosingMonths = closingMonthly.map(m => m.month).sort();
      const latestClosingMonth = sortedClosingMonths[sortedClosingMonths.length - 1];
      const closingYtd = latestClosingMonth 
        ? closingMonthly.find(m => m.month === latestClosingMonth)?.value || 0 
        : 0;

      const actuals: MetricActuals[] = [
        {
          metricName: "New Software Booking ARR",
          monthlyActuals: newBookingMonthly,
          ytdTotal: newBookingYtd,
        },
        {
          metricName: "Closing ARR",
          monthlyActuals: closingMonthly,
          ytdTotal: closingYtd,
        },
      ];

      return { actuals };
    },
  });
}
/**
 * Fetch actuals for a specific employee (admin use)
 * Supports multi-participant attribution
 */
export function useEmployeeActuals(employeeId: string | undefined, fiscalYear: number = 2026) {
  return useQuery({
    queryKey: ["employee_actuals", employeeId, fiscalYear],
    queryFn: async () => {
      if (!employeeId) return { actuals: [] };

      const fiscalYearStart = `${fiscalYear}-01-01`;
      const fiscalYearEnd = `${fiscalYear}-12-31`;

      // Fetch ALL deals with all participant role columns
      const { data: deals } = await supabase
        .from("deals")
        .select(`
          new_software_booking_arr_usd,
          sales_rep_employee_id,
          sales_head_employee_id,
          sales_engineering_employee_id,
          sales_engineering_head_employee_id,
          product_specialist_employee_id,
          product_specialist_head_employee_id,
          solution_manager_employee_id,
          solution_manager_head_employee_id,
          solution_architect_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Check if employee has "Org " prefix metrics
      const { data: empData } = await supabase
        .from("employees")
        .select("sales_function")
        .eq("employee_id", employeeId)
        .maybeSingle();

      const salesFunction = empData?.sales_function || "";
      const isOrgRole = salesFunction === "Overlay" || salesFunction === "Executive";

      // Filter and aggregate deals
      let newBookingYtd = 0;
      let orgNewBookingYtd = 0;
      (deals || []).forEach((deal: any) => {
        const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
        if (isParticipant) {
          newBookingYtd += deal.new_software_booking_arr_usd || 0;
        }
        // Org-level: sum ALL deals without participant filter
        if (isOrgRole) {
          orgNewBookingYtd += deal.new_software_booking_arr_usd || 0;
        }
      });

      // Fetch ELIGIBLE closing ARR actuals (both sales_rep and sales_head attribution)
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr, end_date, sales_rep_employee_id, sales_head_employee_id")
        .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .gt("end_date", `${fiscalYear}-12-31`); // ELIGIBILITY FILTER

      // Group eligible Closing ARR by month and use only the LATEST month
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach((arr) => {
        const monthKey = arr.month_year?.substring(0, 7) || "";
        closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + (arr.closing_arr || 0));
      });
      
      const sortedClosingMonths = Array.from(closingByMonth.keys()).sort();
      const latestClosingMonth = sortedClosingMonths[sortedClosingMonths.length - 1];
      const closingYtd = latestClosingMonth ? closingByMonth.get(latestClosingMonth) || 0 : 0;

      return {
        newSoftwareBookingArr: isOrgRole ? orgNewBookingYtd : newBookingYtd,
        closingArr: closingYtd,
      };
    },
    enabled: !!employeeId,
  });
}