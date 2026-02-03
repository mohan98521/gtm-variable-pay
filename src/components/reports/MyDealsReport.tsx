import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, FileSpreadsheet, Loader2, Link as LinkIcon, Info, TrendingUp } from "lucide-react";
import { DealRecord } from "@/hooks/useMyActualsData";
import { useMyDealsWithIncentives, DealWithIncentives, calculateVPSummaryFromDeals } from "@/hooks/useMyDealsWithIncentives";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { generateXLSX, downloadXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";

// All deal columns for export including new incentive columns
const DEAL_COLUMNS: { key: keyof DealWithIncentives | string; header: string; getValue?: (row: DealWithIncentives) => string | number | null }[] = [
  { key: "project_id", header: "Project ID" },
  { key: "customer_code", header: "Customer Code" },
  { key: "customer_name", header: "Customer Name" },
  { key: "region", header: "Region" },
  { key: "country", header: "Country" },
  { key: "bu", header: "Business Unit" },
  { key: "product", header: "Product" },
  { key: "type_of_proposal", header: "Type of Proposal" },
  { key: "month_year", header: "Month" },
  { key: "first_year_amc_usd", header: "First Year AMC (USD)" },
  { key: "first_year_subscription_usd", header: "First Year Subscription (USD)" },
  { key: "new_software_booking_arr_usd", header: "New Software Booking ARR (USD)" },
  { key: "managed_services_usd", header: "Managed Services (USD)" },
  { key: "implementation_usd", header: "Implementation (USD)" },
  { key: "cr_usd", header: "CR (USD)" },
  { key: "er_usd", header: "ER (USD)" },
  { key: "tcv_usd", header: "TCV (USD)" },
  { key: "perpetual_license_usd", header: "Perpetual License (USD)" },
  { key: "gp_margin_percent", header: "GP Margin %" },
  // New collection columns
  { key: "collection_status", header: "Collection Status" },
  { key: "collection_date", header: "Collection Date" },
  { key: "linked_to_impl", header: "Linked to Implementation", getValue: (row) => row.linked_to_impl ? "Yes" : "No" },
  // New incentive columns
  { key: "eligible_incentive_usd", header: "Eligible Commission (USD)" },
  { key: "payout_on_booking_usd", header: "Commission Paid on Booking (USD)" },
  { key: "payout_on_collection_usd", header: "Commission Held for Collection (USD)" },
  { key: "payout_on_year_end_usd", header: "Commission Held for Year-End (USD)" },
  { key: "actual_paid_usd", header: "Commission Actual Paid (USD)" },
  // Variable Pay columns
  { key: "vp_proportion_pct", header: "VP Proportion %" },
  { key: "vp_eligible_usd", header: "VP Eligible (USD)" },
  { key: "vp_payout_on_booking_usd", header: "VP Paid on Booking (USD)" },
  { key: "vp_payout_on_collection_usd", header: "VP Held for Collection (USD)" },
  { key: "vp_payout_on_year_end_usd", header: "VP Held for Year-End (USD)" },
  { key: "vp_clawback_eligible_usd", header: "VP Clawback Eligible (USD)" },
  // Participant columns
  { key: "sales_rep_employee_id", header: "Sales Rep ID" },
  { key: "sales_rep_name", header: "Sales Rep Name" },
  { key: "sales_head_employee_id", header: "Sales Head ID" },
  { key: "sales_head_name", header: "Sales Head Name" },
  { key: "sales_engineering_employee_id", header: "SE ID" },
  { key: "sales_engineering_name", header: "SE Name" },
  { key: "sales_engineering_head_employee_id", header: "SE Head ID" },
  { key: "sales_engineering_head_name", header: "SE Head Name" },
  { key: "product_specialist_employee_id", header: "Product Specialist ID" },
  { key: "product_specialist_name", header: "Product Specialist Name" },
  { key: "product_specialist_head_employee_id", header: "Product Specialist Head ID" },
  { key: "product_specialist_head_name", header: "Product Specialist Head Name" },
  { key: "solution_manager_employee_id", header: "Solution Manager ID" },
  { key: "solution_manager_name", header: "Solution Manager Name" },
  { key: "solution_manager_head_employee_id", header: "Solution Manager Head ID" },
  { key: "solution_manager_head_name", header: "Solution Manager Head Name" },
  { key: "status", header: "Status" },
  { key: "notes", header: "Notes" },
];

// Generate month options
function getMonthOptions(year: number) {
  const months = [
    { value: "all", label: "Full Year" },
  ];
  for (let m = 1; m <= 12; m++) {
    const monthStr = m.toString().padStart(2, "0");
    const date = new Date(year, m - 1, 1);
    months.push({
      value: `${year}-${monthStr}`,
      label: format(date, "MMMM yyyy"),
    });
  }
  return months;
}

// Collection status badge component
function CollectionStatusBadge({ status, collectionDate }: { status: string; collectionDate: string | null }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    Pending: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    Collected: { variant: "default", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    Clawback: { variant: "destructive", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    Overdue: { variant: "outline", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  };

  const { variant, className } = variants[status] || { variant: "secondary", className: "" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={className}>
            {status}
          </Badge>
        </TooltipTrigger>
        {status === "Collected" && collectionDate && (
          <TooltipContent>
            <p>Collected on {collectionDate}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

// Linked to Impl indicator
function LinkedToImplIndicator({ linked }: { linked: boolean }) {
  if (!linked) return <span className="text-muted-foreground">-</span>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-primary">
            <LinkIcon className="h-3.5 w-3.5" />
            Yes
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>100% on Collection (0% on Booking)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Incentive breakdown tooltip
function IncentiveBreakdownTooltip({ deal }: { deal: DealWithIncentives }) {
  if (deal.incentive_breakdown.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {formatCurrency(deal.eligible_incentive_usd)}
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            {deal.incentive_breakdown.map((b, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{b.type}:</span> ${b.value.toLocaleString()} × {b.rate}% = ${b.amount.toLocaleString()}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
};

export function MyDealsReport() {
  const { selectedYear } = useFiscalYear();
  const { canViewAllData } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  
  const monthParam = selectedMonth === "all" ? null : selectedMonth;
  const { data: deals = [], isLoading } = useMyDealsWithIncentives(monthParam);
  
  const monthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear]);
  
  const reportDescription = canViewAllData()
    ? `All deals for fiscal year ${selectedYear}`
    : `Deals contributing to your incentive computation for ${selectedYear}`;

  // Calculate totals including incentive metrics
  const totals = useMemo(() => {
    const pendingDeals = deals.filter((d) => d.collection_status === "Pending" || d.collection_status === "Overdue");
    const collectedDeals = deals.filter((d) => d.collection_status === "Collected");
    const clawbackDeals = deals.filter((d) => d.collection_status === "Clawback");

    return {
      // Deal counts
      count: deals.length,
      pendingCount: pendingDeals.length,
      collectedCount: collectedDeals.length,
      clawbackCount: clawbackDeals.length,
      
      // Value totals
      newSoftwareBookingArr: deals.reduce((sum, d) => sum + (d.new_software_booking_arr_usd || 0), 0),
      tcv: deals.reduce((sum, d) => sum + (d.tcv_usd || 0), 0),
      
      // Commission Incentive totals
      totalEligibleIncentive: deals.reduce((sum, d) => sum + d.eligible_incentive_usd, 0),
      totalPaidOnBooking: deals.reduce((sum, d) => sum + d.payout_on_booking_usd, 0),
      totalHeldForCollection: deals.reduce((sum, d) => sum + d.payout_on_collection_usd, 0),
      totalHeldForYearEnd: deals.reduce((sum, d) => sum + d.payout_on_year_end_usd, 0),
      totalActualPaid: deals.reduce((sum, d) => sum + d.actual_paid_usd, 0),
      
      // Collection-based breakdown
      pendingCollectionPayout: pendingDeals.reduce((sum, d) => sum + d.payout_on_collection_usd, 0),
      collectedPayout: collectedDeals.reduce((sum, d) => sum + d.payout_on_collection_usd, 0),
    };
  }, [deals]);

  // Calculate Variable Pay summary
  const vpSummary = useMemo(() => calculateVPSummaryFromDeals(deals), [deals]);

  const handleExportCSV = () => {
    const csv = generateCSV(deals, DEAL_COLUMNS);
    downloadCSV(csv, `my_deals_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const handleExportXLSX = () => {
    const blob = generateXLSX(deals, DEAL_COLUMNS, "My Deals");
    downloadXLSX(blob, `my_deals_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{canViewAllData() ? "All Deals (Actuals)" : "My Deals (Actuals)"}</CardTitle>
          <CardDescription>
            {reportDescription}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={deals.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={deals.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No deals found for the selected period.
          </div>
        ) : (
          <>
            {/* Summary Section */}
            <div className="mb-4 space-y-3">
              {/* Deal Totals Row */}
              <div className="p-4 bg-muted/50 rounded-lg flex flex-wrap gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total Deals: </span>
                  <span className="font-semibold">{totals.count}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total ARR: </span>
                  <span className="font-semibold">{formatCurrency(totals.newSoftwareBookingArr)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total TCV: </span>
                  <span className="font-semibold">{formatCurrency(totals.tcv)}</span>
                </div>
                <div className="border-l pl-6">
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {totals.pendingCount} Pending
                  </Badge>
                </div>
                <div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {totals.collectedCount} Collected
                  </Badge>
                </div>
                {totals.clawbackCount > 0 && (
                  <div>
                    <Badge variant="destructive">
                      {totals.clawbackCount} Clawback
                    </Badge>
                  </div>
                )}
              </div>

              {/* Commission Incentive Totals Row */}
              <div className="p-4 bg-primary/5 rounded-lg flex flex-wrap gap-6">
                <div className="font-medium text-sm text-muted-foreground">Commission:</div>
                <div>
                  <span className="text-sm text-muted-foreground">Eligible: </span>
                  <span className="font-semibold text-primary">{formatCurrency(totals.totalEligibleIncentive)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Paid on Booking: </span>
                  <span className="font-semibold text-green-600">{formatCurrency(totals.totalPaidOnBooking)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Pending Collection: </span>
                  <span className="font-semibold text-yellow-600">{formatCurrency(totals.pendingCollectionPayout)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Held for Year-End: </span>
                  <span className="font-semibold text-muted-foreground">{formatCurrency(totals.totalHeldForYearEnd)}</span>
                </div>
              </div>

              {/* Variable Pay Summary Row - Only show if VP data exists */}
              {vpSummary && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Variable Pay (New Software Booking ARR)</span>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <span className="text-sm text-muted-foreground">Total VP: </span>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(vpSummary.totalVariablePayUsd)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Paid on Booking: </span>
                      <span className="font-semibold text-green-600">{formatCurrency(vpSummary.totalPayoutOnBookingUsd)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Held for Collection: </span>
                      <span className="font-semibold text-yellow-600">{formatCurrency(vpSummary.totalPayoutOnCollectionUsd)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Held for Year-End: </span>
                      <span className="font-semibold text-muted-foreground">{formatCurrency(vpSummary.totalPayoutOnYearEndUsd)}</span>
                    </div>
                    {vpSummary.pendingClawbackUsd > 0 && (
                      <div className="border-l pl-4">
                        <span className="text-sm text-muted-foreground">Clawback at Risk: </span>
                        <span className="font-semibold text-orange-600">{formatCurrency(vpSummary.pendingClawbackUsd)}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({deals.filter(d => (d.collection_status === "Pending" || d.collection_status === "Overdue") && d.vp_eligible_usd).length} pending deals)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Project ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>BU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">AMC (USD)</TableHead>
                    <TableHead className="text-right">Subscription (USD)</TableHead>
                    <TableHead className="text-right">ARR (USD)</TableHead>
                    <TableHead className="text-right">Managed Svc (USD)</TableHead>
                    <TableHead className="text-right">Impl (USD)</TableHead>
                    <TableHead className="text-right">CR (USD)</TableHead>
                    <TableHead className="text-right">ER (USD)</TableHead>
                    <TableHead className="text-right">TCV (USD)</TableHead>
                    <TableHead className="text-right">Perpetual (USD)</TableHead>
                    <TableHead className="text-right">GP Margin %</TableHead>
                    {/* Collection columns */}
                    <TableHead className="bg-muted/30">Collection Status</TableHead>
                    <TableHead className="bg-muted/30">Collection Date</TableHead>
                    <TableHead className="bg-muted/30">Linked to Impl</TableHead>
                    {/* Commission columns */}
                    <TableHead className="text-right bg-primary/10">Commission Eligible</TableHead>
                    <TableHead className="text-right bg-green-50 dark:bg-green-950">Comm Paid (Booking)</TableHead>
                    <TableHead className="text-right bg-yellow-50 dark:bg-yellow-950">Comm Held (Collection)</TableHead>
                    <TableHead className="text-right bg-muted/30">Comm Held (Year-End)</TableHead>
                    <TableHead className="text-right bg-green-100 dark:bg-green-900">Comm Actual Paid</TableHead>
                    {/* Variable Pay columns */}
                    <TableHead className="text-right bg-blue-50 dark:bg-blue-950">VP Proportion %</TableHead>
                    <TableHead className="text-right bg-blue-100 dark:bg-blue-900">VP Eligible</TableHead>
                    <TableHead className="text-right bg-green-50 dark:bg-green-950">VP Paid (Booking)</TableHead>
                    <TableHead className="text-right bg-yellow-50 dark:bg-yellow-950">VP Held (Collection)</TableHead>
                    <TableHead className="text-right bg-muted/30">VP Held (Year-End)</TableHead>
                    <TableHead className="text-right bg-orange-50 dark:bg-orange-950">VP Clawback Risk</TableHead>
                    {/* Participant columns */}
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Sales Head</TableHead>
                    <TableHead>SE</TableHead>
                    <TableHead>SE Head</TableHead>
                    <TableHead>Prod Specialist</TableHead>
                    <TableHead>Prod Spec Head</TableHead>
                    <TableHead>Solution Mgr</TableHead>
                    <TableHead>Solution Mgr Head</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {deal.project_id}
                      </TableCell>
                      <TableCell>{deal.customer_name || deal.customer_code}</TableCell>
                      <TableCell>{deal.region}</TableCell>
                      <TableCell>{deal.country}</TableCell>
                      <TableCell>{deal.bu}</TableCell>
                      <TableCell>{deal.product}</TableCell>
                      <TableCell>{deal.type_of_proposal}</TableCell>
                      <TableCell>{deal.month_year}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.first_year_amc_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.first_year_subscription_usd)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(deal.new_software_booking_arr_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.managed_services_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.implementation_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.cr_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.er_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.tcv_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deal.perpetual_license_usd)}</TableCell>
                      <TableCell className="text-right">{formatPercent(deal.gp_margin_percent)}</TableCell>
                      {/* Collection columns */}
                      <TableCell className="bg-muted/30">
                        <CollectionStatusBadge status={deal.collection_status} collectionDate={deal.collection_date} />
                      </TableCell>
                      <TableCell className="bg-muted/30">{deal.collection_date || "-"}</TableCell>
                      <TableCell className="bg-muted/30">
                        <LinkedToImplIndicator linked={deal.linked_to_impl} />
                      </TableCell>
                      {/* Commission columns */}
                      <TableCell className="text-right bg-primary/10">
                        <IncentiveBreakdownTooltip deal={deal} />
                      </TableCell>
                      <TableCell className="text-right bg-green-50 dark:bg-green-950 font-medium text-green-700 dark:text-green-300">
                        {formatCurrency(deal.payout_on_booking_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300">
                        {formatCurrency(deal.payout_on_collection_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-muted/30 text-muted-foreground">
                        {formatCurrency(deal.payout_on_year_end_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-green-100 dark:bg-green-900 font-semibold text-green-800 dark:text-green-200">
                        {formatCurrency(deal.actual_paid_usd)}
                      </TableCell>
                      {/* Variable Pay columns */}
                      <TableCell className="text-right bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {deal.vp_proportion_pct !== null ? `${deal.vp_proportion_pct.toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right bg-blue-100 dark:bg-blue-900 font-medium text-blue-800 dark:text-blue-200">
                        {formatCurrency(deal.vp_eligible_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                        {formatCurrency(deal.vp_payout_on_booking_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300">
                        {formatCurrency(deal.vp_payout_on_collection_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-muted/30 text-muted-foreground">
                        {formatCurrency(deal.vp_payout_on_year_end_usd)}
                      </TableCell>
                      <TableCell className="text-right bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                        {deal.collection_status === "Pending" || deal.collection_status === "Overdue" 
                          ? formatCurrency(deal.vp_clawback_eligible_usd) 
                          : "-"}
                      </TableCell>
                      {/* Participant columns */}
                      <TableCell>{deal.sales_rep_name || deal.sales_rep_employee_id || "-"}</TableCell>
                      <TableCell>{deal.sales_head_name || deal.sales_head_employee_id || "-"}</TableCell>
                      <TableCell>{deal.sales_engineering_name || deal.sales_engineering_employee_id || "-"}</TableCell>
                      <TableCell>{deal.sales_engineering_head_name || deal.sales_engineering_head_employee_id || "-"}</TableCell>
                      <TableCell>{deal.product_specialist_name || deal.product_specialist_employee_id || "-"}</TableCell>
                      <TableCell>{deal.product_specialist_head_name || deal.product_specialist_head_employee_id || "-"}</TableCell>
                      <TableCell>{deal.solution_manager_name || deal.solution_manager_employee_id || "-"}</TableCell>
                      <TableCell>{deal.solution_manager_head_name || deal.solution_manager_head_employee_id || "-"}</TableCell>
                      <TableCell>{deal.status}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{deal.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
