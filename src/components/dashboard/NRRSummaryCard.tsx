import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { NRRCalculationResult } from "@/lib/nrrCalculation";
import { formatCurrencyValue } from "@/lib/utils";

interface NRRSummaryCardProps {
  nrrResult: NRRCalculationResult;
  nrrOtePct: number;
}

export function NRRSummaryCard({ nrrResult, nrrOtePct }: NRRSummaryCardProps) {
  const fmt = (v: number) => formatCurrencyValue(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          NRR Additional Pay
          <Badge variant="secondary" className="ml-auto text-xs">
            {nrrOtePct}% of Variable OTE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">NRR Target</p>
            <p className="text-sm font-semibold">{fmt(nrrResult.nrrTarget)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible Actuals</p>
            <p className="text-sm font-semibold">{fmt(nrrResult.nrrActuals)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Achievement</p>
            <p className="text-sm font-semibold">{nrrResult.achievementPct}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NRR Payout</p>
            <p className="text-sm font-semibold text-success">{fmt(nrrResult.payoutUsd)}</p>
          </div>
        </div>

        {/* CR/ER vs Implementation breakdown */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">CR/ER</p>
            <p>Eligible: {fmt(nrrResult.eligibleCrErUsd)} / {fmt(nrrResult.totalCrErUsd)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Implementation</p>
            <p>Eligible: {fmt(nrrResult.eligibleImplUsd)} / {fmt(nrrResult.totalImplUsd)}</p>
          </div>
        </div>

        {/* Deal breakdown */}
        {nrrResult.dealBreakdowns.length > 0 && (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs text-right">CR/ER</TableHead>
                  <TableHead className="text-xs text-right">Impl</TableHead>
                  <TableHead className="text-xs text-right">GP %</TableHead>
                  <TableHead className="text-xs text-center">Eligible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nrrResult.dealBreakdowns.map((d) => (
                  <TableRow key={d.dealId}>
                    <TableCell className="text-xs font-mono">{d.dealId.substring(0, 8)}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(d.crErUsd)}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(d.implUsd)}</TableCell>
                    <TableCell className="text-xs text-right">{d.gpMarginPct != null ? `${d.gpMarginPct}%` : "N/A"}</TableCell>
                    <TableCell className="text-center">
                      {d.isEligible ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success inline" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive inline" />
                      )}
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
