import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MetricCompensation, CommissionCompensation } from "@/hooks/useCurrentUserCompensation";
import { NRRCalculationResult } from "@/lib/nrrCalculation";
import { SpiffAggregateResult } from "@/lib/spiffCalculation";

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

interface TeamMemberDetailProps {
  metrics: MetricCompensation[];
  commissions: CommissionCompensation[];
  totalEligiblePayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalYearEndHoldback: number;
  totalCommissionPayout: number;
  totalCommissionPaid: number;
  totalCommissionHoldback: number;
  totalCommissionYearEndHoldback: number;
  nrrResult: NRRCalculationResult | null;
  nrrOtePct: number;
  spiffResult: SpiffAggregateResult | null;
  clawbackAmount: number;
}

export function TeamMemberDetail({
  metrics,
  commissions,
  totalEligiblePayout,
  totalPaid,
  totalHoldback,
  totalYearEndHoldback,
  totalCommissionPayout,
  totalCommissionPaid,
  totalCommissionHoldback,
  totalCommissionYearEndHoldback,
  nrrResult,
  nrrOtePct,
  spiffResult,
  clawbackAmount,
}: TeamMemberDetailProps) {
  const hasNrr = nrrResult && (nrrResult.nrrActuals > 0 || nrrResult.nrrTarget > 0);
  const hasSpiff = spiffResult && spiffResult.totalSpiffUsd > 0;

  return (
    <div className="space-y-4 py-2">
      {/* Metrics Table */}
      {metrics.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Variable Pay Metrics</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Metric</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Actual</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Achiev. %</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Multiplier</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Eligible</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Booking</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Collection</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Year End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m.metricName}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{m.metricName}</span>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {m.weightagePercent}% wt
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {m.logicType.replace("_", " ")}
                          </Badge>
                          {m.gateThreshold && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Gate: {m.gateThreshold}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(m.targetValue)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(m.actualValue)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-semibold ${
                        m.achievementPct >= 100 ? "text-success"
                          : m.achievementPct >= 85 ? "text-warning"
                          : "text-destructive"
                      }`}>
                        {formatPercent(m.achievementPct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={m.multiplier > 1 ? "default" : m.multiplier === 0 ? "destructive" : "secondary"}
                        className="font-mono text-xs"
                      >
                        {m.multiplier.toFixed(2)}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(m.eligiblePayout)}</TableCell>
                    <TableCell className="text-right text-sm text-success">{formatCurrency(m.amountPaid)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(m.holdback)}</TableCell>
                    <TableCell className="text-right text-sm text-warning">{formatCurrency(m.yearEndHoldback)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={5} className="text-sm font-semibold">Variable Pay Totals</TableCell>
                  <TableCell className="text-right text-sm font-bold">{formatCurrency(totalEligiblePayout)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-success">{formatCurrency(totalPaid)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-muted-foreground">{formatCurrency(totalHoldback)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-warning">{formatCurrency(totalYearEndHoldback)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* Commission Table */}
      {commissions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Commission Earnings</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Deal Value</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Rate</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Gross Payout</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Booking</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Collection</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Year End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.commissionType}>
                    <TableCell className="text-sm font-medium">{c.commissionType}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.dealValue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-mono text-xs">{c.rate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(c.grossPayout)}</TableCell>
                    <TableCell className="text-right text-sm text-success">{formatCurrency(c.amountPaid)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(c.holdback)}</TableCell>
                    <TableCell className="text-right text-sm text-warning">{formatCurrency(c.yearEndHoldback)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="text-sm font-semibold">Commission Totals</TableCell>
                  <TableCell className="text-right text-sm font-bold">{formatCurrency(totalCommissionPayout)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-success">{formatCurrency(totalCommissionPaid)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-muted-foreground">{formatCurrency(totalCommissionHoldback)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-warning">{formatCurrency(totalCommissionYearEndHoldback)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* NRR Additional Pay */}
      {hasNrr && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">NRR Additional Pay (CR/ER + Implementation)</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Component</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Eligible</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Achievement</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">CR/ER</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(nrrResult!.eligibleCrErUsd)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(nrrResult!.totalCrErUsd)}</TableCell>
                  <TableCell className="text-right text-sm" rowSpan={2}>{formatCurrency(nrrResult!.nrrTarget)}</TableCell>
                  <TableCell className="text-right text-sm" rowSpan={2}>
                    <span className={`font-semibold ${
                      nrrResult!.achievementPct >= 100 ? "text-success"
                        : nrrResult!.achievementPct >= 85 ? "text-warning"
                        : "text-destructive"
                    }`}>
                      {formatPercent(nrrResult!.achievementPct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold" rowSpan={2}>
                    {formatCurrency(nrrResult!.payoutUsd)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">Implementation</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(nrrResult!.eligibleImplUsd)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(nrrResult!.totalImplUsd)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="text-sm font-semibold">NRR OTE %</TableCell>
                  <TableCell className="text-right text-sm">
                    <Badge variant="outline" className="font-mono text-xs">{nrrOtePct}%</Badge>
                  </TableCell>
                  <TableCell colSpan={2} className="text-right text-sm font-semibold">NRR Payout</TableCell>
                  <TableCell className="text-right text-sm font-bold text-success">{formatCurrency(nrrResult!.payoutUsd)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* SPIFF Bonuses */}
      {hasSpiff && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">SPIFF Bonuses</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">SPIFF</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Rate</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Qualifying Deals</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Eligible Actuals</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Total Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">Large Deal SPIFF</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-xs">{spiffResult!.spiffRatePct}%</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {spiffResult!.breakdowns.filter(b => b.isEligible).length} deal(s)
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(spiffResult!.eligibleActualsUsd)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-success">{formatCurrency(spiffResult!.totalSpiffUsd)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Clawback */}
      {clawbackAmount > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-destructive">Outstanding Clawback</span>
            <span className="text-sm font-bold text-destructive">-{formatCurrency(clawbackAmount)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pending/partial clawback balance being recovered from future payouts</p>
        </div>
      )}

      {metrics.length === 0 && commissions.length === 0 && !hasNrr && !hasSpiff && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No compensation data available for this employee
        </p>
      )}
    </div>
  );
}
