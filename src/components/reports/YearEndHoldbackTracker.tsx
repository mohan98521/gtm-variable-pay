/**
 * Year-End Holdback Tracker Report
 * 
 * Tracks accumulated year-end reserves with employee and monthly breakdowns.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Wallet, CalendarClock, TrendingUp } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useYearEndHoldbackSummary, useEmployeeHoldbacks, useMonthlyHoldbackAccrual } from "@/hooks/useYearEndHoldbacks";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { exportToXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";
import { useCurrencies } from "@/hooks/useCurrencies";

export function YearEndHoldbackTracker() {
  const { selectedYear } = useFiscalYear();
  const { data: summary, isLoading: summaryLoading } = useYearEndHoldbackSummary(selectedYear);
  const { data: employeeData, isLoading: empLoading } = useEmployeeHoldbacks(selectedYear);
  const { data: monthlyData, isLoading: monthlyLoading } = useMonthlyHoldbackAccrual(selectedYear);

  const isLoading = summaryLoading || empLoading || monthlyLoading;
  const { getCurrencySymbol } = useCurrencies();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // getCurrencySymbol is now provided by useCurrencies hook

  const handleExportEmployees = () => {
    if (!employeeData) return;
    exportToXLSX(
      employeeData.map(e => ({
        employee_name: e.employeeName,
        currency: e.localCurrency,
        comp_rate: e.compensationRate,
        vp_holdback_usd: e.vpHoldbackUsd,
        vp_holdback_local: e.vpHoldbackLocal,
        comm_holdback_usd: e.commHoldbackUsd,
        comm_holdback_local: e.commHoldbackLocal,
        total_holdback_usd: e.totalHoldbackUsd,
        total_holdback_local: e.totalHoldbackLocal,
      })),
      `year_end_holdbacks_by_employee_fy${selectedYear}`
    );
  };

  const handleExportMonthly = () => {
    if (!monthlyData) return;
    exportToXLSX(
      monthlyData.map(m => ({
        month: format(new Date(`${m.month}-01`), 'MMMM yyyy'),
        vp_holdback_usd: m.vpHoldbackUsd,
        comm_holdback_usd: m.commHoldbackUsd,
        running_total_usd: m.runningTotalUsd,
      })),
      `year_end_holdbacks_by_month_fy${selectedYear}`
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Year-End Holdback Tracker - FY{selectedYear}
        </h2>
        <p className="text-muted-foreground">Accumulated reserves pending December release</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Accumulated</CardDescription>
            <CardTitle className="text-2xl text-[hsl(var(--azentio-teal))]">
              {formatCurrency(summary?.totalHoldbackUsd || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Reserved for year-end
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VP Holdback</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(summary?.totalVpHoldbackUsd || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 mr-1" />
              Variable pay reserves
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commission Holdback</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(summary?.totalCommHoldbackUsd || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Commission reserves
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[hsl(var(--azentio-navy))] text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Release Date</CardDescription>
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              {summary?.releaseDate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-white/70">
              Pending payroll processing
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Employee */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>By Employee</CardTitle>
            <CardDescription>Individual holdback balances with local currency</CardDescription>
          </div>
          <Button onClick={handleExportEmployees} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-[hsl(var(--azentio-navy))]">
                  <TableHead className="text-white">Employee</TableHead>
                  <TableHead className="text-white">Currency</TableHead>
                  <TableHead className="text-white text-right">Comp Rate</TableHead>
                  <TableHead className="text-white text-right">VP Hold (Local)</TableHead>
                  <TableHead className="text-white text-right">Comm Hold (Local)</TableHead>
                  <TableHead className="text-white text-right">Total (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeData?.map(emp => (
                  <TableRow key={emp.employeeId}>
                    <TableCell className="font-medium">{emp.employeeName}</TableCell>
                    <TableCell>{emp.localCurrency}</TableCell>
                    <TableCell className="text-right">{emp.compensationRate.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {getCurrencySymbol(emp.localCurrency)}{emp.vpHoldbackLocal.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {getCurrencySymbol(emp.localCurrency)}{emp.commHoldbackLocal.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-[hsl(var(--azentio-teal))]">
                      {formatCurrency(emp.totalHoldbackUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {(!employeeData || employeeData.length === 0) && (
            <p className="text-center text-muted-foreground py-4">No holdback data</p>
          )}
        </CardContent>
      </Card>

      {/* By Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Monthly Accrual</CardTitle>
            <CardDescription>Running total by month</CardDescription>
          </div>
          <Button onClick={handleExportMonthly} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--azentio-navy))]">
                <TableHead className="text-white">Month</TableHead>
                <TableHead className="text-white text-right">VP Holdback</TableHead>
                <TableHead className="text-white text-right">Comm Holdback</TableHead>
                <TableHead className="text-white text-right">Running Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData?.map(month => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">
                    {format(new Date(`${month.month}-01`), 'MMMM yyyy')}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(month.vpHoldbackUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(month.commHoldbackUsd)}</TableCell>
                  <TableCell className="text-right font-semibold text-[hsl(var(--azentio-teal))]">
                    {formatCurrency(month.runningTotalUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
