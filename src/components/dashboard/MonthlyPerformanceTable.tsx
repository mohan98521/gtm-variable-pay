import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { MonthlyMetricBreakdown } from "@/hooks/useCurrentUserCompensation";
import { formatCurrencyValue } from "@/lib/utils";
interface MonthlyPerformanceTableProps {
  monthlyBreakdown: MonthlyMetricBreakdown[];
}

const formatCurrency = (value: number) => formatCurrencyValue(value);

export function MonthlyPerformanceTable({ monthlyBreakdown }: MonthlyPerformanceTableProps) {
  // Calculate totals
  const totalNewSoftwareArr = monthlyBreakdown.reduce((sum, m) => sum + m.newSoftwareArr, 0);
  const totalClosingArr = monthlyBreakdown.reduce((sum, m) => sum + m.closingArr, 0);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Monthly Performance Breakdown</CardTitle>
        <CardDescription>Month-by-month actuals for key metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Month</TableHead>
                <TableHead className="text-right font-semibold">New Software Booking ARR</TableHead>
                <TableHead className="text-right font-semibold">Closing ARR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No monthly data available yet
                  </TableCell>
                </TableRow>
              ) : (
                monthlyBreakdown.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell className="font-medium">{month.monthLabel}</TableCell>
                    <TableCell className="text-right font-mono">
                      {month.newSoftwareArr > 0 ? formatCurrency(month.newSoftwareArr) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {month.closingArr > 0 ? formatCurrency(month.closingArr) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30">
                <TableCell className="font-semibold">YTD Total</TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(totalNewSoftwareArr)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(totalClosingArr)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
