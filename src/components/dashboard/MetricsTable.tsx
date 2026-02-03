import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MetricCompensation } from "@/hooks/useCurrentUserCompensation";

interface MetricsTableProps {
  metrics: MetricCompensation[];
  totalEligiblePayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalYearEndHoldback: number;
  clawbackAmount: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// Helper to determine if all metrics have the same payout split
// Note: Uses actual metric values, not assuming defaults. Each plan defines its own splits.
const getUniformPayoutSplit = (metrics: MetricCompensation[]) => {
  if (metrics.length === 0) return { uniform: true, bookingPct: 70, collectionPct: 25, yearEndPct: 5 };
  
  const firstBooking = metrics[0].payoutOnBookingPct ?? 70;
  const firstCollection = metrics[0].payoutOnCollectionPct ?? 25;
  const firstYearEnd = metrics[0].payoutOnYearEndPct ?? 5;
  
  const allSame = metrics.every(
    m => (m.payoutOnBookingPct ?? 70) === firstBooking && 
         (m.payoutOnCollectionPct ?? 25) === firstCollection &&
         (m.payoutOnYearEndPct ?? 5) === firstYearEnd
  );
  
  return { 
    uniform: allSame, 
    bookingPct: firstBooking, 
    collectionPct: firstCollection,
    yearEndPct: firstYearEnd,
  };
};

export function MetricsTable({ 
  metrics, 
  totalEligiblePayout, 
  totalPaid, 
  totalHoldback,
  totalYearEndHoldback,
  clawbackAmount 
}: MetricsTableProps) {
  const payoutSplit = getUniformPayoutSplit(metrics);
  
  // Column headers: if all metrics have same split, show that percentage
  // Otherwise, show generic "Booking" and "Collection"
  const bookingHeader = payoutSplit.uniform 
    ? `Booking (${payoutSplit.bookingPct}%)` 
    : "Booking";
  const collectionHeader = payoutSplit.uniform 
    ? `Collection (${payoutSplit.collectionPct}%)` 
    : "Collection";
  const yearEndHeader = payoutSplit.uniform 
    ? `Year End (${payoutSplit.yearEndPct}%)` 
    : "Year End";

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Metric-wise Performance Summary</CardTitle>
        <CardDescription>Achievement and payout breakdown by metric</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold">Target</TableHead>
                <TableHead className="text-right font-semibold">Actual</TableHead>
                <TableHead className="text-right font-semibold">Achiev. %</TableHead>
                <TableHead className="text-right font-semibold">Multiplier</TableHead>
                <TableHead className="text-right font-semibold">Eligible Payout</TableHead>
                <TableHead className="text-right font-semibold">{bookingHeader}</TableHead>
                <TableHead className="text-right font-semibold">{collectionHeader}</TableHead>
                <TableHead className="text-right font-semibold">{yearEndHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No metrics configured for this plan
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((metric) => (
                  <TableRow key={metric.metricName}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{metric.metricName}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {metric.weightagePercent}% weight
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                          >
                            {metric.logicType.replace("_", " ")}
                          </Badge>
                          {metric.gateThreshold && (
                            <Badge variant="destructive" className="text-xs">
                              Gate: {metric.gateThreshold}%
                            </Badge>
                          )}
                          {!payoutSplit.uniform && (
                            <Badge variant="outline" className="text-xs">
                              {metric.payoutOnBookingPct ?? 70}/{metric.payoutOnCollectionPct ?? 25}/{metric.payoutOnYearEndPct ?? 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(metric.targetValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(metric.actualValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${
                        metric.achievementPct >= 100 
                          ? "text-success" 
                          : metric.achievementPct >= 85 
                            ? "text-warning" 
                            : "text-destructive"
                      }`}>
                        {formatPercent(metric.achievementPct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={metric.multiplier > 1 ? "default" : metric.multiplier === 0 ? "destructive" : "secondary"}
                        className="font-mono"
                      >
                        {metric.multiplier.toFixed(2)}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(metric.eligiblePayout)}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {formatCurrency(metric.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(metric.holdback)}
                    </TableCell>
                    <TableCell className="text-right text-warning">
                      {formatCurrency(metric.yearEndHoldback)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={5} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {formatCurrency(totalEligiblePayout)}
                </TableCell>
                <TableCell className="text-right font-bold text-success">
                  {formatCurrency(totalPaid)}
                </TableCell>
                <TableCell className="text-right font-bold text-muted-foreground">
                  {formatCurrency(totalHoldback)}
                </TableCell>
                <TableCell className="text-right font-bold text-warning">
                  {formatCurrency(totalYearEndHoldback)}
                </TableCell>
              </TableRow>
              {clawbackAmount > 0 && (
                <TableRow className="bg-destructive/10">
                  <TableCell colSpan={5} className="font-semibold text-destructive">
                    Clawback
                  </TableCell>
                  <TableCell colSpan={4} className="text-right font-bold text-destructive">
                    -{formatCurrency(clawbackAmount)}
                  </TableCell>
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
