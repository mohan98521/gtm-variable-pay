import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PayoutRun {
  id: string;
  month_year: string;
  run_status: string;
  is_locked: boolean;
  finalized_at: string | null;
}

interface MonthLockResult {
  isLocked: boolean;
  isLoading: boolean;
  payoutRun: PayoutRun | null;
}

/**
 * Check if a specific month is locked for payouts.
 * A month is locked when a payout run exists with is_locked = true.
 */
export function useMonthLockStatus(monthYear: string | undefined): MonthLockResult {
  const { data, isLoading } = useQuery({
    queryKey: ["month-lock-status", monthYear],
    queryFn: async () => {
      if (!monthYear) return null;

      const { data, error } = await supabase
        .from("payout_runs")
        .select("id, month_year, run_status, is_locked, finalized_at")
        .eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking month lock status:", error);
        throw error;
      }

      return data as PayoutRun | null;
    },
    enabled: !!monthYear,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    isLocked: data?.is_locked ?? false,
    isLoading,
    payoutRun: data ?? null,
  };
}

/**
 * Check lock status for multiple months at once.
 * Useful for checking locks across a list of deals with different booking months.
 */
export function useMonthLockStatuses(months: string[]): {
  lockStatusMap: Map<string, boolean>;
  isLoading: boolean;
} {
  const uniqueMonths = [...new Set(months.filter(Boolean))];

  const { data, isLoading } = useQuery({
    queryKey: ["month-lock-statuses", uniqueMonths.sort().join(",")],
    queryFn: async () => {
      if (uniqueMonths.length === 0) return [];

      const { data, error } = await supabase
        .from("payout_runs")
        .select("month_year, is_locked")
        .in("month_year", uniqueMonths)
        .eq("is_locked", true);

      if (error) {
        console.error("Error checking month lock statuses:", error);
        throw error;
      }

      return data || [];
    },
    enabled: uniqueMonths.length > 0,
    staleTime: 30000,
  });

  const lockStatusMap = new Map<string, boolean>();
  
  // Initialize all months as unlocked
  uniqueMonths.forEach((month) => lockStatusMap.set(month, false));
  
  // Mark locked months
  data?.forEach((run) => {
    if (run.is_locked) {
      lockStatusMap.set(run.month_year, true);
    }
  });

  return {
    lockStatusMap,
    isLoading,
  };
}

/**
 * Helper to check if error is a month lock error
 */
export function isMonthLockError(error: Error): boolean {
  return error.message.includes("locked payout month");
}

/**
 * Get user-friendly error message for month lock errors
 */
export function getMonthLockErrorMessage(error: Error): string {
  if (isMonthLockError(error)) {
    return "This month is locked for payouts. Use payout adjustments for corrections.";
  }
  return error.message;
}
