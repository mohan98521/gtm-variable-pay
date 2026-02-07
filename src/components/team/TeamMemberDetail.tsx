import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MetricCompensation, CommissionCompensation } from "@/hooks/useCurrentUserCompensation";

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
}: TeamMemberDetailProps) {
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

      {metrics.length === 0 && commissions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No compensation data available for this employee
        </p>
      )}
    </div>
  );
}
