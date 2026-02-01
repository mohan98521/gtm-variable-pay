import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

// All 8 participant role columns in the deals table
const PARTICIPANT_ROLES = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
] as const;

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
          month_year,
          new_software_booking_arr_usd,
          sales_rep_employee_id,
          sales_head_employee_id,
          sales_engineering_employee_id,
          sales_engineering_head_employee_id,
          product_specialist_employee_id,
          product_specialist_head_employee_id,
          solution_manager_employee_id,
          solution_manager_head_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      if (dealsError) throw dealsError;

      // Filter deals where current employee is ANY participant and aggregate
      const newBookingByMonth = new Map<string, number>();
      (deals || []).forEach((deal: DealRow) => {
        // Check if current employee is ANY participant in this deal
        const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
        
        if (isParticipant) {
          const monthKey = deal.month_year?.substring(0, 7) || ""; // YYYY-MM
          const current = newBookingByMonth.get(monthKey) || 0;
          newBookingByMonth.set(monthKey, current + (deal.new_software_booking_arr_usd || 0));
        }
      });

      // Fetch closing ARR actuals (check both sales_rep and sales_head attribution)
      const { data: closingArr, error: closingError } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr, sales_rep_employee_id, sales_head_employee_id")
        .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      if (closingError) throw closingError;

      // Aggregate Closing ARR by month
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach((arr) => {
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

      // Calculate YTD totals
      const newBookingYtd = newBookingMonthly.reduce((sum, m) => sum + m.value, 0);
      const closingYtd = closingMonthly.reduce((sum, m) => sum + m.value, 0);

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
          solution_manager_head_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Filter and aggregate deals where employee is ANY participant
      let newBookingYtd = 0;
      (deals || []).forEach((deal: any) => {
        const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
        if (isParticipant) {
          newBookingYtd += deal.new_software_booking_arr_usd || 0;
        }
      });

      // Fetch closing ARR actuals
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr")
        .eq("sales_rep_employee_id", employeeId)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Calculate YTD totals
      const closingYtd = (closingArr || []).reduce((sum, a) => sum + (a.closing_arr || 0), 0);

      return {
        newSoftwareBookingArr: newBookingYtd,
        closingArr: closingYtd,
      };
    },
    enabled: !!employeeId,
  });
}