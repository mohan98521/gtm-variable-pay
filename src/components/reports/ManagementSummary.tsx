/**
 * Management Summary Report
 * 
 * Aggregated executive view in USD showing annual totals,
 * quarterly breakdown, and by sales function.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Loader2, TrendingUp, TrendingDown, DollarSign, Zap, ArrowUpRight } from "lucide-react";
import { useManagementSummary } from "@/hooks/useManagementSummary";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { exportToXLSX } from "@/lib/xlsxExport";

export function ManagementSummary() {
  const { selectedYear } = useFiscalYear();
  const { data, isLoading } = useManagementSummary(selectedYear);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    if (!data) return;
    
    const annualSheet = [{
      metric: 'Total Variable Pay',
      value: data.annualTotals.vpUsd,
    }, {
      metric: 'Total Commissions',
      value: data.annualTotals.commUsd,
    }, {
      metric: 'NRR / SPIFF / Deal Team SPIFF',
      value: data.annualTotals.additionalPayUsd,
    }, {
      metric: 'Collection & Year-End Releases',
      value: data.annualTotals.releaseUsd,
    }, {
      metric: 'Total Clawbacks',
      value: -data.annualTotals.clawbackUsd,
    }, {
      metric: 'Net Payout',
      value: data.annualTotals.netUsd,
    }];

    const quarterlySheet = data.byQuarter.map(q => ({
      quarter: `Q${q.quarter}`,
      variable_pay_usd: q.vpUsd,
      commissions_usd: q.commUsd,
      additional_pay_usd: q.additionalPayUsd,
      releases_usd: q.releaseUsd,
      clawbacks_usd: -q.clawbackUsd,
      net_total_usd: q.netUsd,
    }));

    const functionSheet = data.byFunction.map(f => ({
      sales_function: f.salesFunction,
      headcount: f.headcount,
      variable_pay_usd: f.vpUsd,
      commissions_usd: f.commUsd,
      additional_pay_usd: f.additionalPayUsd,
      avg_per_head: f.avgPerHead,
    }));

    exportToXLSX(
      [...annualSheet.map(a => ({ ...a, section: 'Annual' })),
       ...quarterlySheet.map(q => ({ ...q, section: 'Quarterly' })),
       ...functionSheet.map(f => ({ ...f, section: 'By Function' }))],
      `management_summary_fy${selectedYear}`
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available for FY{selectedYear}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Management Summary - FY{selectedYear}</h2>
          <p className="text-muted-foreground">Aggregated payout overview in USD</p>
        </div>
        <Button onClick={handleExport} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
          <Download className="mr-2 h-4 w-4" />
          Export XLSX
        </Button>
      </div>

      {/* Annual Totals Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Variable Pay</CardDescription>
            <CardTitle className="text-xl text-[hsl(var(--azentio-teal))]">
              {formatCurrency(data.annualTotals.vpUsd)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-success" />
              Performance-based
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commissions</CardDescription>
            <CardTitle className="text-xl text-[hsl(var(--azentio-navy))]">
              {formatCurrency(data.annualTotals.commUsd)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3 mr-1" />
              Deal-based
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NRR / SPIFF</CardDescription>
            <CardTitle className="text-xl text-primary">
              {formatCurrency(data.annualTotals.additionalPayUsd)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Zap className="h-3 w-3 mr-1" />
              Additional pay
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Releases</CardDescription>
            <CardTitle className="text-xl text-accent-foreground">
              {formatCurrency(data.annualTotals.releaseUsd)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Collection & Year-End
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clawbacks</CardDescription>
            <CardTitle className="text-xl text-destructive">
              ({formatCurrency(data.annualTotals.clawbackUsd)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1 text-destructive" />
              Collection failures
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[hsl(var(--azentio-navy))] text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Net Payout</CardDescription>
            <CardTitle className="text-xl">
              {formatCurrency(data.annualTotals.netUsd)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-white/70">
              Total compensation
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>By Quarter</CardTitle>
          <CardDescription>Quarterly payout distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--azentio-navy))]">
                <TableHead className="text-white">Quarter</TableHead>
                <TableHead className="text-white text-right">Variable Pay</TableHead>
                <TableHead className="text-white text-right">Commissions</TableHead>
                <TableHead className="text-white text-right">NRR/SPIFF</TableHead>
                <TableHead className="text-white text-right">Releases</TableHead>
                <TableHead className="text-white text-right">Clawbacks</TableHead>
                <TableHead className="text-white text-right">Net Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byQuarter.map(q => (
                <TableRow key={q.quarter}>
                  <TableCell className="font-medium">Q{q.quarter}</TableCell>
                  <TableCell className="text-right">{formatCurrency(q.vpUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(q.commUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(q.additionalPayUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(q.releaseUsd)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {q.clawbackUsd > 0 ? `(${formatCurrency(q.clawbackUsd)})` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(q.netUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By Sales Function */}
      <Card>
        <CardHeader>
          <CardTitle>By Sales Function</CardTitle>
          <CardDescription>Breakdown by team/role</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--azentio-navy))]">
                <TableHead className="text-white">Function</TableHead>
                <TableHead className="text-white text-right">Headcount</TableHead>
                <TableHead className="text-white text-right">Variable Pay</TableHead>
                <TableHead className="text-white text-right">Commissions</TableHead>
                <TableHead className="text-white text-right">NRR/SPIFF</TableHead>
                <TableHead className="text-white text-right">Avg/Head</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byFunction.map(f => (
                <TableRow key={f.salesFunction}>
                  <TableCell className="font-medium">{f.salesFunction}</TableCell>
                  <TableCell className="text-right">{f.headcount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(f.vpUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(f.commUsd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(f.additionalPayUsd)}</TableCell>
                  <TableCell className="text-right font-semibold text-[hsl(var(--azentio-teal))]">
                    {formatCurrency(f.avgPerHead)}
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
