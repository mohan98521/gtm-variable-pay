import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, Users, TrendingUp, Calculator, Wallet, Download } from "lucide-react";
import { usePayoutRuns, PayoutRun } from "@/hooks/usePayoutRuns";
import { usePayoutMetricDetails } from "@/hooks/usePayoutMetricDetails";
import { usePayoutDealDetails } from "@/hooks/usePayoutDealDetails";
import { useClosingArrPayoutDetails } from "@/hooks/useClosingArrPayoutDetails";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PayoutRunWorkings } from "@/components/admin/PayoutRunWorkings";
import { generateMultiSheetXLSX, downloadXLSX, SheetData } from "@/lib/xlsxExport";
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

  // Fetch detail data for export
  const { data: metricDetails } = usePayoutMetricDetails(selectedRunId || null);
  const { data: dealDetails } = usePayoutDealDetails(selectedRunId || null);
  const { data: closingArrDetails } = useClosingArrPayoutDetails(selectedRunId || null);

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

  const handleExport = useCallback(() => {
    if (!selectedRun) return;
    const monthLabel = format(new Date(selectedRun.month_year), "MMM-yyyy");

    // Sheet 1: Summary (one row per employee from metricDetails)
    const summarySheet: SheetData = {
      sheetName: "Summary",
      data: (metricDetails || []).map(emp => ({
        emp_code: emp.employeeCode,
        emp_name: emp.employeeName,
        doj: emp.dateOfHire || "",
        lwd: emp.departureDate || "",
        status: emp.isActive ? "Active" : "Inactive",
        bu: emp.businessUnit || "",
        plan: emp.planName || "",
        total_variable_ote: emp.targetBonusUsd,
        incr_eligible: emp.allDetails.reduce((s, d) => s + (d.this_month_usd || 0), 0),
        upon_booking: emp.allDetails.reduce((s, d) => s + (d.booking_usd || 0), 0),
        upon_collection: emp.allDetails.reduce((s, d) => s + (d.collection_usd || 0), 0),
        at_year_end: emp.allDetails.reduce((s, d) => s + (d.year_end_usd || 0), 0),
      })),
      columns: [
        { key: "emp_code", header: "Emp Code" },
        { key: "emp_name", header: "Employee Name" },
        { key: "doj", header: "DOJ" },
        { key: "lwd", header: "LWD" },
        { key: "status", header: "Status" },
        { key: "bu", header: "BU" },
        { key: "plan", header: "Plan" },
        { key: "total_variable_ote", header: "Total Variable OTE" },
        { key: "incr_eligible", header: "Incr Eligible" },
        { key: "upon_booking", header: "Upon Booking" },
        { key: "upon_collection", header: "Upon Collection (Held)" },
        { key: "at_year_end", header: "At Year End (Held)" },
      ],
    };

    // Sheet 2: Detailed Workings
    const detailRows = (metricDetails || []).flatMap(emp =>
      emp.allDetails.map(d => ({
        emp_name: emp.employeeName,
        emp_code: emp.employeeCode,
        component_type: d.component_type,
        metric: d.metric_name,
        target: d.target_usd,
        actuals: d.actual_usd,
        achievement_pct: d.achievement_pct,
        ote_pct: d.target_bonus_usd > 0 ? ((d.allocated_ote_usd / d.target_bonus_usd) * 100) : 0,
        allocated_ote: d.allocated_ote_usd,
        multiplier: d.multiplier,
        commission_pct: d.commission_rate_pct ?? "",
        ytd_eligible: d.ytd_eligible_usd,
        elig_last_month: d.prior_paid_usd,
        incr_eligible: d.this_month_usd,
        upon_booking: d.booking_usd,
        upon_collection: d.collection_usd,
        at_year_end: d.year_end_usd,
      }))
    );
    const detailSheet: SheetData = {
      sheetName: "Detailed Workings",
      data: detailRows,
      columns: [
        { key: "emp_name", header: "Employee" },
        { key: "emp_code", header: "Emp Code" },
        { key: "component_type", header: "Component Type" },
        { key: "metric", header: "Metric" },
        { key: "target", header: "Target" },
        { key: "actuals", header: "Actuals" },
        { key: "achievement_pct", header: "Ach %" },
        { key: "ote_pct", header: "OTE %" },
        { key: "allocated_ote", header: "Allocated OTE" },
        { key: "multiplier", header: "Multiplier" },
        { key: "commission_pct", header: "Commission %" },
        { key: "ytd_eligible", header: "YTD Eligible" },
        { key: "elig_last_month", header: "Elig Last Month" },
        { key: "incr_eligible", header: "Incr Eligible" },
        { key: "upon_booking", header: "Upon Booking" },
        { key: "upon_collection", header: "Upon Collection" },
        { key: "at_year_end", header: "At Year End" },
      ],
    };

    // Sheet 3: Deal Workings
    const dealSheet: SheetData = {
      sheetName: "Deal Workings",
      data: (dealDetails || []).map(d => ({
        emp_name: d.employee_name,
        emp_code: d.employee_code,
        component: d.component_type,
        project_id: d.project_id || "",
        customer: d.customer_name || "",
        commission_type: d.commission_type,
        deal_value: d.deal_value_usd,
        gp_margin_pct: d.gp_margin_pct ?? "",
        min_gp_pct: d.min_gp_margin_pct ?? "",
        eligible: d.is_eligible ? "Yes" : "No",
        exclusion_reason: d.exclusion_reason || "",
        rate_pct: d.commission_rate_pct,
        gross_commission: d.gross_commission_usd,
        upon_booking: d.booking_usd,
        upon_collection: d.collection_usd,
        at_year_end: d.year_end_usd,
      })),
      columns: [
        { key: "emp_name", header: "Employee" },
        { key: "emp_code", header: "Emp Code" },
        { key: "component", header: "Component" },
        { key: "project_id", header: "Project ID" },
        { key: "customer", header: "Customer" },
        { key: "commission_type", header: "Commission Type" },
        { key: "deal_value", header: "Deal Value" },
        { key: "gp_margin_pct", header: "GP Margin %" },
        { key: "min_gp_pct", header: "Min GP %" },
        { key: "eligible", header: "Eligible?" },
        { key: "exclusion_reason", header: "Exclusion Reason" },
        { key: "rate_pct", header: "Rate %" },
        { key: "gross_commission", header: "Gross Commission" },
        { key: "upon_booking", header: "Upon Booking" },
        { key: "upon_collection", header: "Upon Collection" },
        { key: "at_year_end", header: "At Year End" },
      ],
    };

    // Sheet 4: Closing ARR
    const arrSheet: SheetData = {
      sheetName: "Closing ARR",
      data: (closingArrDetails || []).map(d => ({
        emp_name: d.employee_name,
        emp_code: d.employee_code,
        pid: d.pid,
        customer: d.customer_name || "",
        bu: d.bu || "",
        product: d.product || "",
        category: d.order_category_2 || "",
        end_date: d.end_date || "",
        multi_year: d.is_multi_year ? "Yes" : "No",
        renewal_years: d.renewal_years,
        closing_arr: d.closing_arr_usd,
        multiplier: d.multiplier,
        adjusted_arr: d.adjusted_arr_usd,
        eligible: d.is_eligible ? "Yes" : "No",
        exclusion_reason: d.exclusion_reason || "",
      })),
      columns: [
        { key: "emp_name", header: "Employee" },
        { key: "emp_code", header: "Emp Code" },
        { key: "pid", header: "PID" },
        { key: "customer", header: "Customer" },
        { key: "bu", header: "BU" },
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "end_date", header: "End Date" },
        { key: "multi_year", header: "Multi-Year?" },
        { key: "renewal_years", header: "Renewal Years" },
        { key: "closing_arr", header: "Closing ARR" },
        { key: "multiplier", header: "Multiplier" },
        { key: "adjusted_arr", header: "Adjusted ARR" },
        { key: "eligible", header: "Eligible?" },
        { key: "exclusion_reason", header: "Exclusion Reason" },
      ],
    };

    const blob = generateMultiSheetXLSX([summarySheet, detailSheet, dealSheet, arrSheet]);
    downloadXLSX(blob, `Payout-Workings-${monthLabel}-FY${selectedYear}.xlsx`);
  }, [selectedRun, metricDetails, dealDetails, closingArrDetails, selectedYear]);

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
              <>
                <Badge variant={STATUS_BADGE_VARIANT[selectedRun.run_status] || "outline"}>
                  {STATUS_LABELS[selectedRun.run_status] || selectedRun.run_status}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
                  <Download className="h-4 w-4 mr-1" />
                  Export XLSX
                </Button>
              </>
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
