/**
 * Payout Run Detail View
 * 
 * Detailed view showing:
 * - Run summary with Total Eligible + Payable This Month
 * - Employee breakdown with three-way split columns
 * - Filter by currency
 * - Export functionality (CSV + XLSX)
 * - Clawbacks display
 * - Adjustments management
 */

import { useState } from "react";
import { format, parse } from "date-fns";
import { PayoutRun } from "@/hooks/usePayoutRuns";
import { useEmployeePayoutBreakdown, usePayoutSummary, EmployeePayoutSummary } from "@/hooks/useMonthlyPayouts";
import { usePayoutMetricDetails } from "@/hooks/usePayoutMetricDetails";
import { usePayoutDealDetails } from "@/hooks/usePayoutDealDetails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Download, 
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Banknote,
  Wallet
} from "lucide-react";
import { generateMultiSheetXLSX, downloadXLSX, SheetData } from "@/lib/xlsxExport";
import { PayoutAdjustments } from "./PayoutAdjustments";
import { PayoutRunWorkings } from "./PayoutRunWorkings";

interface PayoutRunDetailProps {
  run: PayoutRun;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-primary/10 text-primary",
  finalized: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function PayoutRunDetail({ run, onBack }: PayoutRunDetailProps) {
  const { data: employeeBreakdown, isLoading: loadingEmployees } = useEmployeePayoutBreakdown(run.id);
  const { data: currencySummary, isLoading: loadingSummary } = usePayoutSummary(run.id);
  const { data: metricDetails } = usePayoutMetricDetails(run.id);
  const { data: dealDetails } = usePayoutDealDetails(run.id);
  
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("summary");
  
  const formatMonthYear = (monthYear: string) => {
    try {
      const date = parse(monthYear, 'yyyy-MM', new Date());
      return format(date, 'MMMM yyyy');
    } catch {
      return monthYear;
    }
  };
  
  const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
    if (value === null || value === undefined) return '-';
    
    const symbol = currency === 'USD' ? '$' : currency;
    const formatted = value.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
    
    return currency === 'USD' ? `$${formatted}` : `${formatted} ${currency}`;
  };
  
  // Get unique currencies for filter
  const currencies = [...new Set(employeeBreakdown?.map(e => e.localCurrency) || [])].sort();
  
  // Filter employees by currency
  const filteredEmployees = currencyFilter === 'all' 
    ? employeeBreakdown 
    : employeeBreakdown?.filter(e => e.localCurrency === currencyFilter);
  
  // Calculate filtered totals
  const filteredTotals = filteredEmployees?.reduce((acc, emp) => ({
    variablePayUsd: acc.variablePayUsd + emp.variablePayUsd,
    commissionsUsd: acc.commissionsUsd + emp.commissionsUsd,
    dealTeamSpiffUsd: acc.dealTeamSpiffUsd + emp.dealTeamSpiffUsd,
    totalEligibleUsd: acc.totalEligibleUsd + emp.totalEligibleUsd,
    totalBookingUsd: acc.totalBookingUsd + emp.totalBookingUsd,
    totalCollectionUsd: acc.totalCollectionUsd + emp.totalCollectionUsd,
    totalYearEndUsd: acc.totalYearEndUsd + emp.totalYearEndUsd,
    collectionReleasesUsd: acc.collectionReleasesUsd + emp.collectionReleasesUsd,
    payableThisMonthUsd: acc.payableThisMonthUsd + emp.payableThisMonthUsd,
  }), { 
    variablePayUsd: 0, commissionsUsd: 0, dealTeamSpiffUsd: 0, totalEligibleUsd: 0, 
    totalBookingUsd: 0, totalCollectionUsd: 0, totalYearEndUsd: 0,
    collectionReleasesUsd: 0, payableThisMonthUsd: 0
  });

  // Grand totals for summary cards
  const grandTotals = employeeBreakdown?.reduce((acc, emp) => ({
    totalEligibleUsd: acc.totalEligibleUsd + emp.totalEligibleUsd,
    variablePayUsd: acc.variablePayUsd + emp.variablePayUsd,
    commissionsUsd: acc.commissionsUsd + emp.commissionsUsd,
    payableThisMonthUsd: acc.payableThisMonthUsd + emp.payableThisMonthUsd,
  }), { totalEligibleUsd: 0, variablePayUsd: 0, commissionsUsd: 0, payableThisMonthUsd: 0 });
  
  const handleExportCSV = () => {
    if (!filteredEmployees) return;
    
    const headers = [
      'Employee Code',
      'Employee Name',
      'Plan',
      'Currency',
      'VP (USD)',
      'Comm (USD)',
      'DT SPIFF (USD)',
      'Total Eligible (USD)',
      'Upon Booking (USD)',
      'Upon Collection (USD)',
      'At Year End (USD)',
      'Collection Releases (USD)',
      'Payable This Month (USD)',
    ];
    
    const rows = filteredEmployees.map(emp => [
      emp.employeeCode,
      emp.employeeName,
      emp.planName || '-',
      emp.localCurrency,
      emp.variablePayUsd.toFixed(2),
      emp.commissionsUsd.toFixed(2),
      emp.dealTeamSpiffUsd.toFixed(2),
      emp.totalEligibleUsd.toFixed(2),
      emp.totalBookingUsd.toFixed(2),
      emp.totalCollectionUsd.toFixed(2),
      emp.totalYearEndUsd.toFixed(2),
      emp.collectionReleasesUsd.toFixed(2),
      emp.payableThisMonthUsd.toFixed(2),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-run-${run.month_year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleExportXLSX = () => {
    if (!employeeBreakdown) return;
    
    const sheets: SheetData[] = [];
    
    const allEmployeesColumns = [
      { key: 'employeeCode', header: 'Employee Code' },
      { key: 'employeeName', header: 'Employee Name' },
      { key: 'planName', header: 'Plan' },
      { key: 'localCurrency', header: 'Currency' },
      { key: 'variablePayUsd', header: 'VP (USD)' },
      { key: 'commissionsUsd', header: 'Comm (USD)' },
      { key: 'dealTeamSpiffUsd', header: 'DT SPIFF (USD)' },
      { key: 'totalEligibleUsd', header: 'Total Eligible (USD)' },
      { key: 'totalBookingUsd', header: 'Upon Booking (USD)' },
      { key: 'totalCollectionUsd', header: 'Upon Collection (USD)' },
      { key: 'totalYearEndUsd', header: 'At Year End (USD)' },
      { key: 'collectionReleasesUsd', header: 'Collection Releases (USD)' },
      { key: 'payableThisMonthUsd', header: 'Payable This Month (USD)' },
    ];
    
    // Sheet 1: Summary
    sheets.push({
      sheetName: 'Summary',
      data: [{
        month: formatMonthYear(run.month_year),
        status: run.run_status,
        totalEligibleUsd: grandTotals?.totalEligibleUsd || 0,
        variablePayUsd: grandTotals?.variablePayUsd || 0,
        commissionsUsd: grandTotals?.commissionsUsd || 0,
        payableThisMonthUsd: grandTotals?.payableThisMonthUsd || 0,
        clawbacksUsd: run.total_clawbacks_usd || 0,
        employeeCount: employeeBreakdown.length,
        calculatedAt: run.calculated_at ? format(new Date(run.calculated_at), 'yyyy-MM-dd HH:mm') : '',
      }],
      columns: [
        { key: 'month', header: 'Month' },
        { key: 'status', header: 'Status' },
        { key: 'totalEligibleUsd', header: 'Total Eligible (USD)' },
        { key: 'variablePayUsd', header: 'Variable Pay (USD)' },
        { key: 'commissionsUsd', header: 'Commissions (USD)' },
        { key: 'payableThisMonthUsd', header: 'Payable This Month (USD)' },
        { key: 'clawbacksUsd', header: 'Clawbacks (USD)' },
        { key: 'employeeCount', header: 'Employee Count' },
        { key: 'calculatedAt', header: 'Calculated At' },
      ],
    });
    
    // Sheet 2: All Employees
    sheets.push({
      sheetName: 'All Employees',
      data: employeeBreakdown,
      columns: allEmployeesColumns as any,
    });
    
    // Sheets per currency
    for (const currency of currencies) {
      const currencyEmployees = employeeBreakdown.filter(e => e.localCurrency === currency);
      if (currencyEmployees.length === 0) continue;
      
      sheets.push({
        sheetName: currency,
        data: currencyEmployees,
        columns: allEmployeesColumns as any,
      });
    }
    
    // Detailed Workings sheet - pivoted one-row-per-employee
    if (metricDetails && metricDetails.length > 0) {
      const GROUP_ORDER: Record<string, number> = {
        variable_pay: 0, commission: 1, nrr: 2, spiff: 3,
        deal_team_spiff: 4, collection_release: 5, year_end_release: 6, clawback: 7,
      };
      const metricsSeen = new Map<string, { metricName: string; componentType: string }>();
      for (const emp of metricDetails) {
        for (const d of emp.allDetails) {
          const key = `${d.component_type}::${d.metric_name}`;
          if (!metricsSeen.has(key)) {
            metricsSeen.set(key, { metricName: d.metric_name, componentType: d.component_type });
          }
        }
      }
      const discoveredMetrics = Array.from(metricsSeen.values()).sort((a, b) => {
        const ga = GROUP_ORDER[a.componentType] ?? 99;
        const gb = GROUP_ORDER[b.componentType] ?? 99;
        if (ga !== gb) return ga - gb;
        return a.metricName.localeCompare(b.metricName);
      });

      // Component-type-aware sub-labels
      const VP_SUB_LABELS = [
        'Target', 'Actuals', 'Ach %', 'OTE %', 'Allocated OTE', 'Multiplier',
        'YTD Eligible', 'Eligible Till Last Month', 'Incremental Eligible',
        'Upon Booking', 'Upon Collection', 'At Year End',
      ];
      const COMM_SUB_LABELS = [
        'Commission %', 'Actuals (TCV)',
        'YTD Eligible', 'Eligible Till Last Month', 'Incremental Eligible',
        'Upon Booking', 'Upon Collection', 'At Year End',
      ];
      const SPIFF_SUB_LABELS = [
        'OTE %', 'Allocated OTE', 'Actuals',
        'YTD Eligible', 'Eligible Till Last Month', 'Incremental Eligible',
        'Upon Booking', 'Upon Collection', 'At Year End',
      ];

      function getSubLabels(componentType: string): string[] {
        if (componentType === 'commission') return COMM_SUB_LABELS;
        if (componentType === 'spiff' || componentType === 'deal_team_spiff') return SPIFF_SUB_LABELS;
        return VP_SUB_LABELS;
      }

      const workingsColumns: any[] = [
        { key: 'empCode', header: 'Emp Code' },
        { key: 'empName', header: 'Emp Name' },
        { key: 'dateOfHire', header: 'Date of Joining' },
        { key: 'departureDate', header: 'Last Working Day' },
        { key: 'status', header: 'Status' },
        { key: 'businessUnit', header: 'BU' },
        { key: 'plan', header: 'Plan' },
        { key: 'totalVariableOte', header: 'Total Variable OTE' },
      ];
      for (const mc of discoveredMetrics) {
        const subLabels = getSubLabels(mc.componentType);
        for (const sub of subLabels) {
          workingsColumns.push({
            key: `${mc.componentType}::${mc.metricName}::${sub}`,
            header: `${mc.metricName} - ${sub}`,
          });
        }
      }
      workingsColumns.push(
        { key: 'gt_incr', header: 'Grand Total - Incr Eligible' },
        { key: 'gt_current_month_payable', header: 'Grand Total - Current Month Payable' },
        { key: 'gt_coll_held', header: 'Grand Total - Upon Collection (Held)' },
        { key: 'gt_ye_held', header: 'Grand Total - At Year End (Held)' },
      );

      const fmtOtePct = (alloc: number | null, bonus: number | null) => {
        if (!alloc || !bonus || bonus === 0) return '';
        return `${((alloc / bonus) * 100).toFixed(2)}%`;
      };

      const workingsData = metricDetails.map(emp => {
        const row: Record<string, any> = {
          empCode: emp.employeeCode,
          empName: emp.employeeName,
          dateOfHire: emp.dateOfHire || '',
          departureDate: emp.departureDate || '',
          status: emp.isActive ? 'Active' : 'Inactive',
          businessUnit: emp.businessUnit || '',
          plan: emp.planName || '',
          totalVariableOte: emp.targetBonusUsd || 0,
        };
        const dm = new Map<string, any>();
        for (const d of emp.allDetails) dm.set(`${d.component_type}::${d.metric_name}`, d);

        for (const mc of discoveredMetrics) {
          const key = `${mc.componentType}::${mc.metricName}`;
          const d = dm.get(key);
          const subLabels = getSubLabels(mc.componentType);
          if (d) {
            if (mc.componentType === 'commission') {
              row[`${key}::Commission %`] = d.commission_rate_pct != null ? `${d.commission_rate_pct.toFixed(2)}%` : '';
              row[`${key}::Actuals (TCV)`] = d.actual_usd ?? '';
            } else if (mc.componentType === 'spiff' || mc.componentType === 'deal_team_spiff') {
              row[`${key}::OTE %`] = fmtOtePct(d.allocated_ote_usd, d.target_bonus_usd);
              row[`${key}::Allocated OTE`] = d.allocated_ote_usd ?? '';
              row[`${key}::Actuals`] = d.actual_usd ?? '';
            } else {
              row[`${key}::Target`] = d.target_usd ?? '';
              row[`${key}::Actuals`] = d.actual_usd ?? '';
              row[`${key}::Ach %`] = d.achievement_pct != null ? `${d.achievement_pct.toFixed(4)}%` : '';
              row[`${key}::OTE %`] = fmtOtePct(d.allocated_ote_usd, d.target_bonus_usd);
              row[`${key}::Allocated OTE`] = d.allocated_ote_usd ?? '';
              row[`${key}::Multiplier`] = d.multiplier ? `${d.multiplier.toFixed(2)}x` : '';
            }
            // Common payout columns
            row[`${key}::YTD Eligible`] = d.ytd_eligible_usd ?? '';
            row[`${key}::Eligible Till Last Month`] = d.prior_paid_usd ?? '';
            row[`${key}::Incremental Eligible`] = d.this_month_usd ?? '';
            row[`${key}::Upon Booking`] = d.booking_usd ?? '';
            row[`${key}::Upon Collection`] = d.collection_usd ?? '';
            row[`${key}::At Year End`] = d.year_end_usd ?? '';
          } else {
            for (const sub of subLabels) row[`${key}::${sub}`] = '';
          }
        }
        row.gt_incr = emp.allDetails.reduce((s: number, d: any) => s + (d.this_month_usd || 0), 0);
        // Current Month Payable = Upon Booking + Collection Releases + Year-End Releases - Clawback Recovery
        const totalUponBooking = emp.allDetails.reduce((s: number, d: any) => s + (d.booking_usd || 0), 0);
        const collReleases = emp.allDetails.filter((d: any) => d.component_type === 'collection_release').reduce((s: number, d: any) => s + (d.this_month_usd || 0), 0);
        const yeReleases = emp.allDetails.filter((d: any) => d.component_type === 'year_end_release').reduce((s: number, d: any) => s + (d.this_month_usd || 0), 0);
        const clawback = emp.allDetails.filter((d: any) => d.component_type === 'clawback').reduce((s: number, d: any) => s + Math.abs(d.this_month_usd || 0), 0);
        row.gt_current_month_payable = totalUponBooking + collReleases + yeReleases - clawback;
        row.gt_coll_held = emp.allDetails.reduce((s: number, d: any) => s + (d.collection_usd || 0), 0);
        row.gt_ye_held = emp.allDetails.reduce((s: number, d: any) => s + (d.year_end_usd || 0), 0);
        return row;
      });

      sheets.push({
        sheetName: 'Detailed Workings',
        data: workingsData,
        columns: workingsColumns,
      });
    }
    
    // Deal Workings sheet
    if (dealDetails && dealDetails.length > 0) {
      sheets.push({
        sheetName: 'Deal Workings',
        data: dealDetails,
        columns: [
          { key: 'employee_code', header: 'Employee Code', getValue: (r: any) => r.employee_code || '' },
          { key: 'employee_name', header: 'Employee Name', getValue: (r: any) => r.employee_name || '' },
          { key: 'component_type', header: 'Component', getValue: (r: any) => r.component_type || '' },
          { key: 'project_id', header: 'Project ID' },
          { key: 'customer_name', header: 'Customer' },
          { key: 'commission_type', header: 'Commission Type' },
          { key: 'deal_value_usd', header: 'Deal Value (USD)' },
          { key: 'gp_margin_pct', header: 'GP Margin %' },
          { key: 'min_gp_margin_pct', header: 'Min GP %' },
          { key: 'is_eligible', header: 'Eligible', getValue: (r: any) => r.is_eligible ? 'Yes' : 'No' },
          { key: 'exclusion_reason', header: 'Exclusion Reason' },
          { key: 'commission_rate_pct', header: 'Rate / Mix %' },
          { key: 'gross_commission_usd', header: 'Gross Commission (USD)' },
          { key: 'booking_usd', header: 'Upon Booking (USD)' },
          { key: 'collection_usd', header: 'Upon Collection (USD)' },
          { key: 'year_end_usd', header: 'At Year End (USD)' },
        ] as any,
      });
    }
    
    const blob = generateMultiSheetXLSX(sheets);
    downloadXLSX(blob, `payout-run-${run.month_year}.xlsx`);
  };
  
  const isLoading = loadingEmployees || loadingSummary;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              Payout Run: {formatMonthYear(run.month_year)}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={STATUS_COLORS[run.run_status]}>
                {run.run_status.charAt(0).toUpperCase() + run.run_status.slice(1)}
              </Badge>
              {run.calculated_at && (
                <span className="text-sm text-muted-foreground">
                  Calculated: {format(new Date(run.calculated_at), 'MMM d, yyyy h:mm a')}
                </span>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={!employeeBreakdown?.length}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportXLSX}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export XLSX (Multi-sheet)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Eligible</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(grandTotals?.totalEligibleUsd)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Variable Pay</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(grandTotals?.variablePayUsd)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                <Percent className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commissions</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(grandTotals?.commissionsUsd)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payable This Month</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(grandTotals?.payableThisMonthUsd)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-2xl font-semibold">
                  {employeeBreakdown?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Currency Summary */}
      {currencySummary && currencySummary.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary by Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">VP (USD)</TableHead>
                  <TableHead className="text-right">VP (Local)</TableHead>
                  <TableHead className="text-right">Comm (USD)</TableHead>
                  <TableHead className="text-right">Comm (Local)</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencySummary.map((summary) => (
                  <TableRow key={summary.currency}>
                    <TableCell className="font-medium">{summary.currency}</TableCell>
                    <TableCell className="text-right">{summary.employeeCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.variablePayUsd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.variablePayLocal, summary.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.commissionsUsd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.commissionsLocal, summary.currency)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(summary.totalUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs: Summary vs Detailed Workings */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="workings">Detailed Workings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-6">
          {/* Employee Breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Employee Payouts</CardTitle>
                <CardDescription>
                  Three-way split breakdown with collection releases
                </CardDescription>
              </div>
              {currencies.length > 1 && (
                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All currencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currencies</SelectItem>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEmployees && filteredEmployees.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">VP (USD)</TableHead>
                        <TableHead className="text-right">Comm (USD)</TableHead>
                        <TableHead className="text-right">DT SPIFF</TableHead>
                        <TableHead className="text-right">Total Eligible</TableHead>
                        <TableHead className="text-right">Upon Booking</TableHead>
                        <TableHead className="text-right">Upon Collection</TableHead>
                        <TableHead className="text-right">At Year End</TableHead>
                        <TableHead className="text-right">Coll. Releases</TableHead>
                        <TableHead className="text-right">Payable This Month</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{emp.employeeName}</p>
                              <p className="text-sm text-muted-foreground">{emp.employeeCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{emp.planName || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{emp.localCurrency}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.variablePayUsd)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.commissionsUsd)}</TableCell>
                          <TableCell className="text-right">
                            {emp.dealTeamSpiffUsd > 0 ? formatCurrency(emp.dealTeamSpiffUsd) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(emp.totalEligibleUsd)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.totalBookingUsd)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.totalCollectionUsd)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.totalYearEndUsd)}</TableCell>
                          <TableCell className="text-right">
                            {emp.collectionReleasesUsd > 0 
                              ? formatCurrency(emp.collectionReleasesUsd) 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(emp.payableThisMonthUsd)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      {filteredTotals && (
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell colSpan={3}>
                            Total ({filteredEmployees.length} employees)
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.variablePayUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.commissionsUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {filteredTotals.dealTeamSpiffUsd > 0 ? formatCurrency(filteredTotals.dealTeamSpiffUsd) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.totalEligibleUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.totalBookingUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.totalCollectionUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.totalYearEndUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(filteredTotals.collectionReleasesUsd)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(filteredTotals.payableThisMonthUsd)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No employee payouts found. Run the calculation to generate payouts.
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Adjustments Section */}
          <PayoutAdjustments 
            payoutRunId={run.id} 
            monthYear={run.month_year} 
            runStatus={run.run_status}
          />
        </TabsContent>
        
        <TabsContent value="workings">
          <PayoutRunWorkings payoutRunId={run.id} />
        </TabsContent>
      </Tabs>
      
      {/* Notes */}
      {run.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{run.notes}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Paid Info */}
      {run.run_status === 'paid' && run.paid_at && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Payment Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Marked as paid on {format(new Date(run.paid_at), 'MMMM d, yyyy h:mm a')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
