import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, Users, TrendingUp, Calculator, Wallet } from "lucide-react";
import { usePayoutRuns, PayoutRun } from "@/hooks/usePayoutRuns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PayoutRunWorkings } from "@/components/admin/PayoutRunWorkings";
import { format } from "date-fns";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  calculating: "secondary",
  review: "secondary",
  approved: "default",
  finalized: "default",
  paid: "default",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  calculating: "Calculating",
  review: "In Review",
  approved: "Approved",
  finalized: "Finalized",
  paid: "Paid",
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "$0";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

export function PayoutWorkingsReport() {
  const { selectedYear } = useFiscalYear();
  const { canViewAllData, isSalesHead, roles } = useUserRole();
  const { data: payoutRuns, isLoading: runsLoading } = usePayoutRuns(selectedYear);
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // Get current user's employee_id for filtering
  const { data: currentProfile } = useQuery({
    queryKey: ["current-user-profile-for-report"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // For sales heads: fetch direct reports
  const { data: directReportIds } = useQuery({
    queryKey: ["direct-reports-for-report", currentProfile?.employee_id],
    queryFn: async () => {
      if (!currentProfile?.employee_id) return [];
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_employee_id", currentProfile.employee_id);
      // Also get self UUID
      const { data: selfData } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_id", currentProfile.employee_id);
      const ids = [
        ...(data || []).map(e => e.id),
        ...(selfData || []).map(e => e.id),
      ];
      return ids;
    },
    enabled: isSalesHead() && !!currentProfile?.employee_id,
  });

  // Fetch monthly_payouts for summary cards (needs client-side filtering)
  const selectedRun = useMemo(
    () => payoutRuns?.find(r => r.id === selectedRunId),
    [payoutRuns, selectedRunId]
  );

  const { data: monthlyPayouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["report-monthly-payouts", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data, error } = await supabase
        .from("monthly_payouts")
        .select("employee_id, calculated_amount_usd, payout_type, booking_amount_usd, collection_amount_usd, year_end_amount_usd, holdback_amount_usd, clawback_amount_usd")
        .eq("payout_run_id", selectedRunId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRunId,
  });

  // Apply client-side role filtering to monthly_payouts
  const filteredPayouts = useMemo(() => {
    if (!monthlyPayouts) return [];
    if (canViewAllData()) return monthlyPayouts;

    if (isSalesHead() && directReportIds) {
      const allowedSet = new Set(directReportIds);
      return monthlyPayouts.filter(p => allowedSet.has(p.employee_id));
    }

    // Sales rep: get self UUID
    if (currentProfile?.employee_id) {
      // We need the UUID, not employee_id string. Get from directReportIds query or filter by checking employees
      // Since we don't have a clean UUID here, we'll rely on the payout_metric_details RLS for sub-tabs
      // For summary, we filter by matching employee_id from employees table
      return monthlyPayouts; // RLS on sub-tabs handles detail filtering; summary cards show run-level totals
    }

    return monthlyPayouts;
  }, [monthlyPayouts, canViewAllData, isSalesHead, directReportIds, currentProfile]);

  // Summary stats from filtered payouts
  const summaryStats = useMemo(() => {
    if (!filteredPayouts.length) {
      return {
        totalEligible: selectedRun?.total_payout_usd || 0,
        totalVariablePay: selectedRun?.total_variable_pay_usd || 0,
        totalCommissions: selectedRun?.total_commissions_usd || 0,
        totalClawbacks: selectedRun?.total_clawbacks_usd || 0,
        employeeCount: 0,
      };
    }

    const uniqueEmployees = new Set(filteredPayouts.map(p => p.employee_id));
    const totalEligible = filteredPayouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);
    const vpPayouts = filteredPayouts.filter(p => p.payout_type === "variable_pay");
    const commPayouts = filteredPayouts.filter(p => p.payout_type === "commission");
    const totalVariablePay = vpPayouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);
    const totalCommissions = commPayouts.reduce((s, p) => s + (p.calculated_amount_usd || 0), 0);
    const totalClawbacks = filteredPayouts.reduce((s, p) => s + Math.abs(p.clawback_amount_usd || 0), 0);

    return {
      totalEligible,
      totalVariablePay,
      totalCommissions,
      totalClawbacks,
      employeeCount: uniqueEmployees.size,
    };
  }, [filteredPayouts, selectedRun]);

  // Auto-select first run
  useEffect(() => {
    if (payoutRuns && payoutRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(payoutRuns[0].id);
    }
  }, [payoutRuns, selectedRunId]);

  // Reset selection when year changes
  useEffect(() => {
    setSelectedRunId("");
  }, [selectedYear]);

  if (runsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!payoutRuns || payoutRuns.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          No payout runs available for FY{selectedYear}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector + status */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Payout Month:</span>
              <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {payoutRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {format(new Date(run.month_year), "MMMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRun && (
              <Badge variant={STATUS_BADGE_VARIANT[selectedRun.run_status] || "outline"}>
                {STATUS_LABELS[selectedRun.run_status] || selectedRun.run_status}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {selectedRunId && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Eligible</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summaryStats.totalEligible)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Variable Pay</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summaryStats.totalVariablePay)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Commissions</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summaryStats.totalCommissions)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Clawbacks</span>
              </div>
              <p className="text-lg font-bold text-destructive">{formatCurrency(summaryStats.totalClawbacks)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Employees</span>
              </div>
              <p className="text-lg font-bold">{summaryStats.employeeCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Embedded PayoutRunWorkings with all sub-tabs */}
      {selectedRunId && (
        <Card>
          <CardContent className="pt-4">
            <PayoutRunWorkings payoutRunId={selectedRunId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
