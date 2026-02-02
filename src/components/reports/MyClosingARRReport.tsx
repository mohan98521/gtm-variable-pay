import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import { useMyClosingARR, ClosingARRRecord } from "@/hooks/useMyActualsData";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { generateXLSX, downloadXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

// All Closing ARR columns for export
const CLOSING_ARR_COLUMNS: { key: keyof ClosingARRRecord | string; header: string; getValue?: (row: ClosingARRRecord) => string | number | null }[] = [
  { key: "month_year", header: "Month" },
  { key: "bu", header: "BU" },
  { key: "product", header: "Product" },
  { key: "pid", header: "PID" },
  { key: "customer_code", header: "Customer Code" },
  { key: "customer_name", header: "Customer Name" },
  { key: "order_category", header: "Order Category" },
  { key: "status", header: "Status" },
  { key: "order_category_2", header: "Order Category 2" },
  { key: "opening_arr", header: "Opening ARR" },
  { key: "cr", header: "CR" },
  { key: "als_others", header: "ALS + Others" },
  { key: "new", header: "New" },
  { key: "inflation", header: "Inflation" },
  { key: "discount_decrement", header: "Discount/Decrement" },
  { key: "churn", header: "Churn" },
  { key: "adjustment", header: "Adjustment" },
  { key: "closing_arr", header: "Closing ARR" },
  { key: "country", header: "Country" },
  { key: "revised_region", header: "Revised Region" },
  { key: "start_date", header: "Start Date" },
  { key: "end_date", header: "End Date" },
  { key: "renewal_status", header: "Renewal Status" },
  { key: "sales_rep_employee_id", header: "Sales Rep ID" },
  { key: "sales_rep_name", header: "Sales Rep Name" },
  { key: "sales_head_employee_id", header: "Sales Head ID" },
  { key: "sales_head_name", header: "Sales Head Name" },
  { key: "eligible_closing_arr", header: "Eligible Closing ARR" },
  { key: "is_eligible", header: "Eligible", getValue: (row) => row.is_eligible ? "Yes" : "No" },
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

export function MyClosingARRReport() {
  const { selectedYear } = useFiscalYear();
  const { canViewAllData } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  
  const monthParam = selectedMonth === "all" ? null : selectedMonth;
  const { data: records = [], isLoading } = useMyClosingARR(monthParam);
  
  const monthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear]);
  
  const reportDescription = canViewAllData()
    ? `All Closing ARR records for fiscal year ${selectedYear}`
    : `Closing ARR records contributing to your incentive computation for ${selectedYear}`;

  // Calculate totals - for Full Year, use latest month logic
  const totals = useMemo(() => {
    const totalClosingArr = records.reduce((sum, r) => sum + (r.closing_arr || 0), 0);
    const totalEligibleClosingArr = records.reduce((sum, r) => sum + r.eligible_closing_arr, 0);
    const eligibleCount = records.filter((r) => r.is_eligible).length;

    // For "Full Year", we need to show the latest month's eligible ARR (consistent with computation)
    let achievementEligibleArr = totalEligibleClosingArr;
    if (selectedMonth === "all" && records.length > 0) {
      // Group by month and find latest
      const byMonth = new Map<string, number>();
      records.forEach((r) => {
        const monthKey = r.month_year?.substring(0, 7) || "";
        byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + r.eligible_closing_arr);
      });
      const sortedMonths = Array.from(byMonth.keys()).sort();
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      achievementEligibleArr = latestMonth ? byMonth.get(latestMonth) || 0 : 0;
    }

    return {
      totalClosingArr,
      totalEligibleClosingArr,
      achievementEligibleArr,
      eligibleCount,
      totalCount: records.length,
    };
  }, [records, selectedMonth]);

  const handleExportCSV = () => {
    const csv = generateCSV(records, CLOSING_ARR_COLUMNS);
    downloadCSV(csv, `my_closing_arr_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const handleExportXLSX = () => {
    const blob = generateXLSX(records, CLOSING_ARR_COLUMNS, "My Closing ARR");
    downloadXLSX(blob, `my_closing_arr_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{canViewAllData() ? "All Closing ARR (Actuals)" : "My Closing ARR (Actuals)"}</CardTitle>
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
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={records.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Eligibility explanation */}
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Records with <strong>End Date &gt; Dec 31, {selectedYear}</strong> are eligible for achievement calculation.
            {selectedMonth === "all" && (
              <span className="block mt-1 text-muted-foreground">
                For Full Year view, achievement uses only the <strong>latest month's</strong> eligible Closing ARR.
              </span>
            )}
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No Closing ARR records found for the selected period.
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mb-4 p-4 bg-muted/50 rounded-lg flex flex-wrap gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Total Records: </span>
                <span className="font-semibold">{totals.totalCount}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Eligible Records: </span>
                <span className="font-semibold text-green-600">{totals.eligibleCount}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Closing ARR: </span>
                <span className="font-semibold">{formatCurrency(totals.totalClosingArr)}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Eligible Closing ARR: </span>
                <span className="font-semibold text-green-600">{formatCurrency(totals.totalEligibleClosingArr)}</span>
              </div>
              {selectedMonth === "all" && (
                <div className="border-l pl-6 ml-2">
                  <span className="text-sm text-muted-foreground">Achievement Value (Latest Month): </span>
                  <span className="font-semibold text-primary">{formatCurrency(totals.achievementEligibleArr)}</span>
                </div>
              )}
            </div>

            {/* Table */}
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">PID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>BU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Order Cat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Opening ARR</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                    <TableHead className="text-right">ALS+Others</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Inflation</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Churn</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                    <TableHead className="text-right">Closing ARR</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Sales Head</TableHead>
                    <TableHead className="text-right">Eligible ARR</TableHead>
                    <TableHead className="text-center">Eligible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} className={!record.is_eligible ? "opacity-60" : ""}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {record.pid}
                      </TableCell>
                      <TableCell>{record.customer_name || record.customer_code}</TableCell>
                      <TableCell>{record.month_year}</TableCell>
                      <TableCell>{record.bu}</TableCell>
                      <TableCell>{record.product}</TableCell>
                      <TableCell>{record.order_category || "-"}</TableCell>
                      <TableCell>{record.status || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.opening_arr)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.cr)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.als_others)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.new)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.inflation)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.discount_decrement)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.churn)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.adjustment)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(record.closing_arr)}</TableCell>
                      <TableCell>{record.country || "-"}</TableCell>
                      <TableCell>{record.revised_region || "-"}</TableCell>
                      <TableCell>{record.start_date || "-"}</TableCell>
                      <TableCell>{record.end_date || "-"}</TableCell>
                      <TableCell>{record.renewal_status || "-"}</TableCell>
                      <TableCell>{record.sales_rep_name || record.sales_rep_employee_id || "-"}</TableCell>
                      <TableCell>{record.sales_head_name || record.sales_head_employee_id || "-"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {record.is_eligible ? formatCurrency(record.eligible_closing_arr) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.is_eligible ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
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
