/**
 * Payout Run Detail View
 * 
 * Detailed view showing:
 * - Run summary
 * - Employee breakdown with dual-currency display
 * - Filter by currency
 * - Export functionality
 */

import { useState } from "react";
import { format, parse } from "date-fns";
import { PayoutRun } from "@/hooks/usePayoutRuns";
import { useEmployeePayoutBreakdown, usePayoutSummary, EmployeePayoutSummary } from "@/hooks/useMonthlyPayouts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft, 
  Download, 
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  Percent
} from "lucide-react";

interface PayoutRunDetailProps {
  run: PayoutRun;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-warning/10 text-warning-foreground",
  approved: "bg-primary/10 text-primary",
  finalized: "bg-success/10 text-success",
};

export function PayoutRunDetail({ run, onBack }: PayoutRunDetailProps) {
  const { data: employeeBreakdown, isLoading: loadingEmployees } = useEmployeePayoutBreakdown(run.id);
  const { data: currencySummary, isLoading: loadingSummary } = usePayoutSummary(run.id);
  
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  
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
    totalUsd: acc.totalUsd + emp.totalUsd,
    bookingUsd: acc.bookingUsd + emp.bookingUsd,
  }), { variablePayUsd: 0, commissionsUsd: 0, totalUsd: 0, bookingUsd: 0 });
  
  const handleExportCSV = () => {
    if (!filteredEmployees) return;
    
    const headers = [
      'Employee Code',
      'Employee Name',
      'Currency',
      'VP (USD)',
      'VP (Local)',
      'Comp Rate',
      'Comm (USD)',
      'Comm (Local)',
      'Market Rate',
      'Total (USD)',
      'Total (Local)',
      'Booking (USD)',
    ];
    
    const rows = filteredEmployees.map(emp => [
      emp.employeeCode,
      emp.employeeName,
      emp.localCurrency,
      emp.variablePayUsd.toFixed(2),
      emp.variablePayLocal.toFixed(2),
      emp.vpCompRate.toFixed(4),
      emp.commissionsUsd.toFixed(2),
      emp.commissionsLocal.toFixed(2),
      emp.commMarketRate.toFixed(4),
      emp.totalUsd.toFixed(2),
      emp.totalLocal.toFixed(2),
      emp.bookingUsd.toFixed(2),
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
        <Button variant="outline" onClick={handleExportCSV} disabled={!filteredEmployees?.length}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payout</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(run.total_payout_usd)}
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
                  {formatCurrency(run.total_variable_pay_usd)}
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
                  {formatCurrency(run.total_commissions_usd)}
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
      
      {/* Employee Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Employee Payouts</CardTitle>
            <CardDescription>
              Detailed breakdown with dual-rate conversion
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
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">VP (USD)</TableHead>
                    <TableHead className="text-right">VP (Local)</TableHead>
                    <TableHead className="text-right">Comp Rate</TableHead>
                    <TableHead className="text-right">Comm (USD)</TableHead>
                    <TableHead className="text-right">Comm (Local)</TableHead>
                    <TableHead className="text-right">Market Rate</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
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
                        <Badge variant="outline">{emp.localCurrency}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(emp.variablePayUsd)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(emp.variablePayLocal, emp.localCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {emp.vpCompRate.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(emp.commissionsUsd)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(emp.commissionsLocal, emp.localCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {emp.commMarketRate.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(emp.totalUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  {filteredTotals && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2}>
                        Total ({filteredEmployees.length} employees)
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(filteredTotals.variablePayUsd)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(filteredTotals.commissionsUsd)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(filteredTotals.totalUsd)}
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
    </div>
  );
}
