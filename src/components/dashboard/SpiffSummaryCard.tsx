import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, CheckCircle, XCircle } from "lucide-react";
import { SpiffAggregateResult } from "@/lib/spiffCalculation";
import { formatCurrencyValue } from "@/lib/utils";

interface SpiffSummaryCardProps {
  spiffResult: SpiffAggregateResult;
}

export function SpiffSummaryCard({ spiffResult }: SpiffSummaryCardProps) {
  const fmt = (v: number) => formatCurrencyValue(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          SPIFF Bonus
          <Badge variant="secondary" className="ml-auto text-xs">
            Rate: {spiffResult.spiffRatePct}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total SPIFF Payout</p>
            <p className="text-sm font-semibold text-success">{fmt(spiffResult.totalSpiffUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Software Variable OTE</p>
            <p className="text-sm font-semibold">{fmt(spiffResult.softwareVariableOteUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Software Target</p>
            <p className="text-sm font-semibold">{fmt(spiffResult.softwareTargetUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible Actuals</p>
            <p className="text-sm font-semibold">{fmt(spiffResult.eligibleActualsUsd)}</p>
          </div>
        </div>

        {/* Deal breakdown */}
        {spiffResult.breakdowns.length > 0 && (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Project ID</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs text-right">Deal ARR</TableHead>
                  <TableHead className="text-xs text-center">Eligible</TableHead>
                  <TableHead className="text-xs text-right">SPIFF Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spiffResult.breakdowns.map((d) => (
                  <TableRow key={d.dealId}>
                    <TableCell className="text-xs font-mono">{d.projectId}</TableCell>
                    <TableCell className="text-xs">{d.customerName || "—"}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(d.dealArrUsd)}</TableCell>
                    <TableCell className="text-center">
                      {d.isEligible ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success inline" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {d.isEligible ? fmt(d.spiffPayoutUsd) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
