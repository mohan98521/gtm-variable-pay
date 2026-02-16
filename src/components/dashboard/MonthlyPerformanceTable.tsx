import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { formatCurrencyValue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MonthlyActualsRow {
  month: string;
  monthLabel: string;
  metrics: Record<string, number>;
}

interface MonthlyPerformanceTableProps {
  monthlyActuals: MonthlyActualsRow[];
  metricNames: string[];
  metricTargets: Record<string, number>;
}

const formatCurrency = (value: number) => formatCurrencyValue(value);

export function MonthlyPerformanceTable({ monthlyActuals, metricNames, metricTargets }: MonthlyPerformanceTableProps) {
  if (metricNames.length === 0) return null;

  // Calculate YTD totals per metric
  const ytdTotals: Record<string, number> = {};
  metricNames.forEach(name => {
    ytdTotals[name] = monthlyActuals.reduce((sum, m) => sum + (m.metrics[name] || 0), 0);
  });

  // Calculate YTD Achievement %
  const ytdAchievement: Record<string, number | null> = {};
  metricNames.forEach(name => {
    const target = metricTargets[name];
    if (target && target > 0) {
      ytdAchievement[name] = (ytdTotals[name] / target) * 100;
    } else {
      ytdAchievement[name] = null;
    }
  });

  // Check if any month has data
  const hasAnyData = monthlyActuals.some(m => 
    metricNames.some(name => (m.metrics[name] || 0) > 0)
  );

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Monthly Performance Breakdown</CardTitle>
        <CardDescription>Month-by-month actuals for all metrics with targets and YTD achievement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[100px]">Month</TableHead>
                {metricNames.map(name => (
                  <TableHead key={name} className="text-right font-semibold min-w-[140px]">
                    {name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Target Row */}
              {Object.keys(metricTargets).length > 0 && (
                <TableRow className="bg-primary/5 border-b-2 border-primary/20">
                  <TableCell className="font-semibold text-primary">
                    Annual Target
                  </TableCell>
                  {metricNames.map(name => (
                    <TableCell key={name} className="text-right font-semibold text-primary font-mono">
                      {metricTargets[name] ? formatCurrency(metricTargets[name]) : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              )}

              {/* Monthly Rows - only show months with data */}
              {!hasAnyData ? (
                <TableRow>
                  <TableCell colSpan={metricNames.length + 1} className="text-center text-muted-foreground py-8">
                    No monthly data available yet
                  </TableCell>
                </TableRow>
              ) : (
                monthlyActuals
                  .filter(month => metricNames.some(name => (month.metrics[name] || 0) > 0))
                  .map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="font-medium">{month.monthLabel}</TableCell>
                      {metricNames.map(name => {
                        const val = month.metrics[name] || 0;
                        return (
                          <TableCell key={name} className="text-right font-mono">
                            {val > 0 ? formatCurrency(val) : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
              )}
            </TableBody>
            <TableFooter>
              {/* YTD Total */}
              <TableRow className="bg-muted/30">
                <TableCell className="font-semibold">YTD Total</TableCell>
                {metricNames.map(name => (
                  <TableCell key={name} className="text-right font-bold font-mono">
                    {ytdTotals[name] > 0 ? formatCurrency(ytdTotals[name]) : "—"}
                  </TableCell>
                ))}
              </TableRow>

              {/* YTD Achievement % */}
              {Object.keys(metricTargets).length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell className="font-semibold">YTD Ach %</TableCell>
                  {metricNames.map(name => {
                    const pct = ytdAchievement[name];
                    if (pct === null) {
                      return (
                        <TableCell key={name} className="text-right text-muted-foreground">
                          —
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={name} className="text-right">
                        <Badge
                          variant={pct >= 100 ? "default" : "secondary"}
                          className={`font-mono ${
                            pct >= 100
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : pct >= 85
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {pct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
