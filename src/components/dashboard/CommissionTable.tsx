import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CommissionCompensation } from "@/hooks/useCurrentUserCompensation";

interface CommissionTableProps {
  commissions: CommissionCompensation[];
  totalGrossPayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalYearEndHoldback: number;
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

export function CommissionTable({ 
  commissions, 
  totalGrossPayout, 
  totalPaid, 
  totalHoldback,
  totalYearEndHoldback
}: CommissionTableProps) {
  if (commissions.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-foreground">
            Commission Structure Summary
          </CardTitle>
          <CardDescription>
            No commission transactions recorded for this period
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Check if all commissions have uniform split percentages
  const firstCommission = commissions[0];
  const hasUniformSplit = commissions.every(
    c => c.payoutOnBookingPct === firstCommission.payoutOnBookingPct &&
         c.payoutOnCollectionPct === firstCommission.payoutOnCollectionPct &&
         c.payoutOnYearEndPct === firstCommission.payoutOnYearEndPct
  );

  // Get split percentages for headers (use first if uniform, otherwise show generic labels)
  const bookingPct = hasUniformSplit ? firstCommission.payoutOnBookingPct : null;
  const collectionPct = hasUniformSplit ? firstCommission.payoutOnCollectionPct : null;
  const yearEndPct = hasUniformSplit ? firstCommission.payoutOnYearEndPct : null;

  const bookingHeader = bookingPct !== null ? `Booking (${bookingPct}%)` : "Booking";
  const collectionHeader = collectionPct !== null ? `Collection (${collectionPct}%)` : "Collection";
  const yearEndHeader = yearEndPct !== null ? `Year-End (${yearEndPct}%)` : "Year-End";

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Commission Structure Summary</CardTitle>
        <CardDescription>Deal-based commission earnings and payout breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Commission Type</TableHead>
                <TableHead className="text-right font-semibold">Deal Value</TableHead>
                <TableHead className="text-right font-semibold">Rate</TableHead>
                <TableHead className="text-right font-semibold">Min Threshold</TableHead>
                <TableHead className="text-right font-semibold">Gross Payout</TableHead>
                <TableHead className="text-right font-semibold">{bookingHeader}</TableHead>
                <TableHead className="text-right font-semibold">{collectionHeader}</TableHead>
                <TableHead className="text-right font-semibold">{yearEndHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission.commissionType}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{commission.commissionType}</span>
                      {commission.minThreshold && commission.dealValue < commission.minThreshold && (
                        <Badge variant="destructive" className="text-xs">Below threshold</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(commission.dealValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono">
                      {commission.rate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {commission.minThreshold ? formatCurrency(commission.minThreshold) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {formatCurrency(commission.grossPayout)}
                  </TableCell>
                  <TableCell className="text-right text-success">
                    {formatCurrency(commission.amountPaid)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(commission.holdback)}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {formatCurrency(commission.yearEndHoldback)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={4} className="font-semibold">Commission Totals</TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {formatCurrency(totalGrossPayout)}
                </TableCell>
                <TableCell className="text-right font-bold text-success">
                  {formatCurrency(totalPaid)}
                </TableCell>
                <TableCell className="text-right font-bold text-muted-foreground">
                  {formatCurrency(totalHoldback)}
                </TableCell>
                <TableCell className="text-right font-bold text-amber-600">
                  {formatCurrency(totalYearEndHoldback)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
