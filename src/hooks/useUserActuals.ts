import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

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

/**
 * Fetch real actuals for the current user from deals and closing_arr_actuals tables
 * Aggregates by metric type and month for dashboard display
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
      // Fetch deals for New Software Booking ARR (grouped by month)
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("month_year, new_software_booking_arr_usd")
        .eq("sales_rep_employee_id", employeeId)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      if (dealsError) throw dealsError;

      // Fetch closing ARR actuals (grouped by month)
      const { data: closingArr, error: closingError } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr")
        .eq("sales_rep_employee_id", employeeId)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      if (closingError) throw closingError;

      // Aggregate New Software Booking ARR by month
      const newBookingByMonth = new Map<string, number>();
      (deals || []).forEach((deal) => {
        const monthKey = deal.month_year?.substring(0, 7) || ""; // YYYY-MM
        const current = newBookingByMonth.get(monthKey) || 0;
        newBookingByMonth.set(monthKey, current + (deal.new_software_booking_arr_usd || 0));
      });

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
 */
export function useEmployeeActuals(employeeId: string | undefined, fiscalYear: number = 2026) {
  return useQuery({
    queryKey: ["employee_actuals", employeeId, fiscalYear],
    queryFn: async () => {
      if (!employeeId) return { actuals: [] };

      const fiscalYearStart = `${fiscalYear}-01-01`;
      const fiscalYearEnd = `${fiscalYear}-12-31`;

      // Fetch deals for New Software Booking ARR
      const { data: deals } = await supabase
        .from("deals")
        .select("month_year, new_software_booking_arr_usd")
        .eq("sales_rep_employee_id", employeeId)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Fetch closing ARR actuals
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr")
        .eq("sales_rep_employee_id", employeeId)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Calculate YTD totals
      const newBookingYtd = (deals || []).reduce((sum, d) => sum + (d.new_software_booking_arr_usd || 0), 0);
      const closingYtd = (closingArr || []).reduce((sum, a) => sum + (a.closing_arr || 0), 0);

      return {
        newSoftwareBookingArr: newBookingYtd,
        closingArr: closingYtd,
      };
    },
    enabled: !!employeeId,
  });
}
