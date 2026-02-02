import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMyDeals, DealRecord } from "@/hooks/useMyActualsData";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { generateXLSX, downloadXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";

// All deal columns for export and display
const DEAL_COLUMNS: { key: keyof DealRecord | string; header: string; getValue?: (row: DealRecord) => string | number | null }[] = [
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

export function MyDealsReport() {
  const { selectedYear } = useFiscalYear();
  const { canViewAllData } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  
  const monthParam = selectedMonth === "all" ? null : selectedMonth;
  const { data: deals = [], isLoading } = useMyDeals(monthParam);
  
  const monthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear]);
  
  const reportDescription = canViewAllData()
    ? `All deals for fiscal year ${selectedYear}`
    : `Deals contributing to your incentive computation for ${selectedYear}`;

  // Calculate totals
  const totals = useMemo(() => {
    return {
      newSoftwareBookingArr: deals.reduce((sum, d) => sum + (d.new_software_booking_arr_usd || 0), 0),
      tcv: deals.reduce((sum, d) => sum + (d.tcv_usd || 0), 0),
      count: deals.length,
    };
  }, [deals]);

  const handleExportCSV = () => {
    const csv = generateCSV(deals, DEAL_COLUMNS);
    downloadCSV(csv, `my_deals_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const handleExportXLSX = () => {
    const blob = generateXLSX(deals, DEAL_COLUMNS, "My Deals");
    downloadXLSX(blob, `my_deals_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(1)}%`;
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
            {/* Summary */}
            <div className="mb-4 p-4 bg-muted/50 rounded-lg flex gap-8">
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
