import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanMetric } from "@/hooks/usePlanMetrics";
import { MetricCompensation, CommissionCompensation } from "@/hooks/useCurrentUserCompensation";
import { PlanConfig, NRRSummaryData, SpiffSummaryData } from "@/hooks/useDashboardPayoutRunData";
import { getMultiplierFromGrid, calculateMarginalPayout } from "@/lib/compensationEngine";

interface PayoutSimulatorProps {
  metrics: MetricCompensation[];
  commissions: CommissionCompensation[];
  planMetrics: PlanMetric[];
  targetBonusUsd: number;
  planConfig?: PlanConfig | null;
  nrrSummary?: NRRSummaryData | null;
  spiffSummary?: SpiffSummaryData | null;
}

interface SimulatedMetric {
  metricName: string;
  targetValue: number;
  simulatedActual: number;
  achievementPct: number;
  allocation: number;
  multiplier: number;
  payout: number;
  logicType: string;
  isCommission: boolean;
  isNrr: boolean;
  isSpiff: boolean;
  rate?: number;
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
  payoutOnYearEndPct: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};

const parseInputValue = (value: string): number => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

export function PayoutSimulator({ metrics, commissions, planMetrics, targetBonusUsd, planConfig, nrrSummary, spiffSummary }: PayoutSimulatorProps) {
  // Build full list of all metrics/commissions from plan config
  const allVpMetrics = useMemo(() => {
    if (!planConfig) return metrics;
    // Merge: use plan config as base, overlay with actuals from payout data
    return planConfig.metrics.map(pm => {
      const existing = metrics.find(m => m.metricName === pm.metricName);
      return existing || {
        metricName: pm.metricName,
        targetValue: 0,
        actualValue: 0,
        achievementPct: 0,
        weightagePercent: pm.weightagePercent,
        allocation: (targetBonusUsd * pm.weightagePercent) / 100,
        multiplier: 1,
        eligiblePayout: 0,
        amountPaid: 0,
        holdback: 0,
        yearEndHoldback: 0,
        logicType: pm.logicType,
        gateThreshold: pm.gateThresholdPercent,
        multiplierGrids: [],
        payoutOnBookingPct: pm.payoutOnBookingPct,
        payoutOnCollectionPct: pm.payoutOnCollectionPct,
        payoutOnYearEndPct: pm.payoutOnYearEndPct,
      };
    });
  }, [planConfig, metrics, targetBonusUsd]);

  const allCommissions = useMemo(() => {
    if (!planConfig) return commissions;
    return planConfig.commissions.map(pc => {
      const existing = commissions.find(c => c.commissionType === pc.commissionType);
      return existing || {
        commissionType: pc.commissionType,
        dealValue: 0,
        rate: pc.ratePct,
        minThreshold: pc.minThresholdUsd,
        grossPayout: 0,
        amountPaid: 0,
        holdback: 0,
        yearEndHoldback: 0,
        payoutOnBookingPct: pc.payoutOnBookingPct,
        payoutOnCollectionPct: pc.payoutOnCollectionPct,
        payoutOnYearEndPct: pc.payoutOnYearEndPct,
      };
    });
  }, [planConfig, commissions]);

  const nrrConfig = planConfig ? { otePct: planConfig.nrrOtePct } : null;
  const spiffConfig = planConfig?.spiffs?.[0] || null;

  // Initialize simulated values
  const [simulatedValues, setSimulatedValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    allVpMetrics.forEach(m => { initial[m.metricName] = m.actualValue; });
    allCommissions.forEach(c => { initial[c.commissionType] = c.dealValue; });
    if (nrrSummary) initial['__nrr_actuals'] = nrrSummary.nrrActuals;
    if (spiffSummary) initial['__spiff_actuals'] = spiffSummary.eligibleActualsUsd;
    return initial;
  });

  const simulatedMetrics: SimulatedMetric[] = useMemo(() => {
    const results: SimulatedMetric[] = [];

    // Variable pay metrics
    allVpMetrics.forEach(metric => {
      const simulatedActual = simulatedValues[metric.metricName] || 0;
      const targetValue = metric.targetValue;
      const achievementPct = targetValue > 0 ? (simulatedActual / targetValue) * 100 : 0;
      const allocation = metric.allocation;

      // Build PlanMetric from config or fallback to planMetrics
      let resolvedMetric: PlanMetric | null = null;
      const configMetric = planConfig?.metrics.find(pm => pm.metricName === metric.metricName);
      if (configMetric && configMetric.multiplierGrids.length > 0) {
        resolvedMetric = {
          id: "", plan_id: "", metric_name: metric.metricName,
          weightage_percent: configMetric.weightagePercent,
          logic_type: configMetric.logicType as any,
          gate_threshold_percent: configMetric.gateThresholdPercent,
          payout_on_booking_pct: configMetric.payoutOnBookingPct,
          payout_on_collection_pct: configMetric.payoutOnCollectionPct,
          payout_on_year_end_pct: configMetric.payoutOnYearEndPct,
          created_at: "",
          multiplier_grids: configMetric.multiplierGrids.map(g => ({
            id: "", plan_metric_id: "", ...g,
          })),
        };
      } else {
        resolvedMetric = planMetrics.find(pm => pm.metric_name === metric.metricName) || null;
      }

      // Calculate multiplier and payout using marginal or flat model
      let multiplier = 1.0;
      let payout = 0;
      const isGated = metric.logicType === "Gated_Threshold";
      const belowGate = isGated && metric.gateThreshold != null && achievementPct <= metric.gateThreshold;

      if (belowGate) {
        multiplier = 0;
        payout = 0;
      } else if (resolvedMetric && (
        resolvedMetric.logic_type === "Stepped_Accelerator" ||
        (resolvedMetric.logic_type === "Gated_Threshold" && (resolvedMetric.multiplier_grids?.length ?? 0) > 0)
      )) {
        const result = calculateMarginalPayout(achievementPct, allocation, resolvedMetric);
        payout = result.payout;
        multiplier = result.weightedMultiplier;
      } else {
        if (resolvedMetric) multiplier = getMultiplierFromGrid(achievementPct, resolvedMetric);
        payout = (achievementPct / 100) * allocation * multiplier;
      }

      results.push({
        metricName: metric.metricName,
        targetValue,
        simulatedActual,
        achievementPct,
        allocation,
        multiplier,
        payout,
        logicType: metric.logicType,
        isCommission: false,
        isNrr: false,
        isSpiff: false,
        payoutOnBookingPct: metric.payoutOnBookingPct,
        payoutOnCollectionPct: metric.payoutOnCollectionPct,
        payoutOnYearEndPct: metric.payoutOnYearEndPct,
      });
    });

    // Commission metrics
    allCommissions.forEach(commission => {
      const simulatedActual = simulatedValues[commission.commissionType] || 0;
      const rate = commission.rate / 100;
      const meetsThreshold = !commission.minThreshold || simulatedActual >= commission.minThreshold;
      const payout = meetsThreshold ? simulatedActual * rate : 0;

      results.push({
        metricName: commission.commissionType,
        targetValue: 0,
        simulatedActual,
        achievementPct: 0,
        allocation: 0,
        multiplier: 1,
        payout,
        logicType: "Commission",
        isCommission: true,
        isNrr: false,
        isSpiff: false,
        rate: commission.rate,
        payoutOnBookingPct: commission.payoutOnBookingPct,
        payoutOnCollectionPct: commission.payoutOnCollectionPct,
        payoutOnYearEndPct: commission.payoutOnYearEndPct,
      });
    });

    // NRR Additional Pay
    if (nrrConfig && nrrConfig.otePct > 0) {
      const nrrTarget = nrrSummary?.nrrTarget || 0;
      const nrrActuals = simulatedValues['__nrr_actuals'] || 0;
      const achievementPct = nrrTarget > 0 ? (nrrActuals / nrrTarget) * 100 : 0;
      const nrrAllocatedOte = targetBonusUsd * (nrrConfig.otePct / 100);
      const payout = nrrTarget > 0 ? nrrAllocatedOte * (nrrActuals / nrrTarget) : 0;

      results.push({
        metricName: "NRR Additional Pay",
        targetValue: nrrTarget,
        simulatedActual: nrrActuals,
        achievementPct,
        allocation: nrrAllocatedOte,
        multiplier: 1,
        payout,
        logicType: `${nrrConfig.otePct}% of Variable OTE`,
        isCommission: false,
        isNrr: true,
        isSpiff: false,
        payoutOnBookingPct: planConfig?.nrrPayoutOnBookingPct ?? 0,
        payoutOnCollectionPct: planConfig?.nrrPayoutOnCollectionPct ?? 100,
        payoutOnYearEndPct: planConfig?.nrrPayoutOnYearEndPct ?? 0,
      });
    }

    // Large Deal SPIFF
    if (spiffConfig) {
      const swMetric = allVpMetrics.find(m => m.metricName === spiffConfig.linkedMetricName);
      const swAllocation = swMetric ? swMetric.allocation : 0;
      const swTarget = swMetric?.targetValue || spiffSummary?.softwareTargetUsd || 0;
      const spiffActuals = simulatedValues['__spiff_actuals'] || 0;
      const achievementPct = swTarget > 0 ? (spiffActuals / swTarget) * 100 : 0;
      const payout = swAllocation * (spiffConfig.spiffRatePct / 100) * (swTarget > 0 ? spiffActuals / swTarget : 0);

      results.push({
        metricName: spiffConfig.spiffName || "Large Deal SPIFF",
        targetValue: swTarget,
        simulatedActual: spiffActuals,
        achievementPct,
        allocation: swAllocation,
        multiplier: 1,
        payout,
        logicType: `SPIFF ${spiffConfig.spiffRatePct}%`,
        isCommission: false,
        isNrr: false,
        isSpiff: true,
        rate: spiffConfig.spiffRatePct,
        payoutOnBookingPct: 0,
        payoutOnCollectionPct: 100,
        payoutOnYearEndPct: 0,
      });
    }

    return results;
  }, [allVpMetrics, allCommissions, planMetrics, planConfig, simulatedValues, targetBonusUsd, nrrConfig, spiffConfig, nrrSummary, spiffSummary]);

  const totalSimulatedPayout = simulatedMetrics.reduce((sum, m) => sum + m.payout, 0);
  const currentTotalPayout = metrics.reduce((sum, m) => sum + m.eligiblePayout, 0) +
    commissions.reduce((sum, c) => sum + c.grossPayout, 0) +
    (nrrSummary?.payoutUsd || 0) + (spiffSummary?.totalSpiffUsd || 0);

  const handleInputChange = (key: string, value: string) => {
    setSimulatedValues(prev => ({ ...prev, [key]: parseInputValue(value) }));
  };

  const resetToCurrentValues = () => {
    const reset: Record<string, number> = {};
    allVpMetrics.forEach(m => { reset[m.metricName] = m.actualValue; });
    allCommissions.forEach(c => { reset[c.commissionType] = c.dealValue; });
    if (nrrSummary) reset['__nrr_actuals'] = nrrSummary.nrrActuals;
    if (spiffSummary) reset['__spiff_actuals'] = spiffSummary.eligibleActualsUsd;
    setSimulatedValues(reset);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              What-If Payout Simulator
            </CardTitle>
            <CardDescription>
              Simulate your payout by adjusting actual values across your full compensation structure
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={resetToCurrentValues} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variable Pay Metrics Inputs */}
        {allVpMetrics.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Variable Pay Metrics</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {allVpMetrics.map((metric) => (
                <div key={metric.metricName} className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{metric.metricName}</Label>
                      <Badge variant="outline" className="text-xs">{metric.weightagePercent}% weight</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: {metric.targetValue > 0 ? formatCurrency(metric.targetValue) : "Not set"} · {metric.logicType.replace("_", " ")}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={(simulatedValues[metric.metricName] || 0).toString()}
                        onChange={(e) => handleInputChange(metric.metricName, e.target.value)}
                        className="font-mono"
                        placeholder="Enter simulated actual"
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Current: {formatCurrency(metric.actualValue)}</span>
                      <span className="text-primary font-medium">
                        Achievement: {metric.targetValue > 0 ? ((simulatedValues[metric.metricName] || 0) / metric.targetValue * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commission Metrics Inputs */}
        {allCommissions.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Commission Metrics</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {allCommissions.map((commission) => (
                <div key={commission.commissionType} className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{commission.commissionType}</Label>
                      <Badge variant="secondary" className="text-xs font-mono">{commission.rate}% rate</Badge>
                    </div>
                    {commission.minThreshold != null && commission.minThreshold > 0 && (
                      <div className="text-xs text-muted-foreground">Min Threshold: {formatCurrency(commission.minThreshold)}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={(simulatedValues[commission.commissionType] || 0).toString()}
                        onChange={(e) => handleInputChange(commission.commissionType, e.target.value)}
                        className="font-mono"
                        placeholder="Enter simulated deal value"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">Current: {formatCurrency(commission.dealValue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NRR & SPIFF Inputs */}
        {(nrrConfig?.otePct || spiffConfig) && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">NRR & SPIFF</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {nrrConfig && nrrConfig.otePct > 0 && (
                <div className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">NRR Additional Pay</Label>
                      <Badge variant="secondary" className="text-xs">{nrrConfig.otePct}% of Variable OTE</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: {nrrSummary?.nrrTarget ? formatCurrency(nrrSummary.nrrTarget) : "Not set"}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={(simulatedValues['__nrr_actuals'] || 0).toString()}
                        onChange={(e) => handleInputChange('__nrr_actuals', e.target.value)}
                        className="font-mono"
                        placeholder="Enter NRR eligible actuals"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current: {formatCurrency(nrrSummary?.nrrActuals || 0)}
                    </div>
                  </div>
                </div>
              )}
              {spiffConfig && (
                <div className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{spiffConfig.spiffName || "Large Deal SPIFF"}</Label>
                      <Badge variant="secondary" className="text-xs font-mono">{spiffConfig.spiffRatePct}% rate</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Min Deal: {formatCurrency(spiffConfig.minDealValueUsd)} · Linked: {spiffConfig.linkedMetricName}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={(simulatedValues['__spiff_actuals'] || 0).toString()}
                        onChange={(e) => handleInputChange('__spiff_actuals', e.target.value)}
                        className="font-mono"
                        placeholder="Enter eligible actuals above threshold"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current: {formatCurrency(spiffSummary?.eligibleActualsUsd || 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results table */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Projected Payouts</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Component</TableHead>
                  <TableHead className="text-right font-semibold">Value</TableHead>
                  <TableHead className="text-right font-semibold">Achiev. %</TableHead>
                  <TableHead className="text-right font-semibold">Multiplier / Rate</TableHead>
                  <TableHead className="text-right font-semibold">Projected Payout</TableHead>
                  <TableHead className="text-right font-semibold">Booking</TableHead>
                  <TableHead className="text-right font-semibold">Collection</TableHead>
                  <TableHead className="text-right font-semibold">Year End</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulatedMetrics.map((metric) => {
                  const bookingAmt = metric.payout * (metric.payoutOnBookingPct / 100);
                  const collectionAmt = metric.payout * (metric.payoutOnCollectionPct / 100);
                  const yearEndAmt = metric.payout * (metric.payoutOnYearEndPct / 100);

                  return (
                    <TableRow key={metric.metricName}>
                      <TableCell className="font-medium">{metric.metricName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(metric.simulatedActual)}</TableCell>
                      <TableCell className="text-right">
                        {metric.isCommission ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={metric.achievementPct >= 100 ? "default" : "secondary"} className="font-mono">
                            {metric.achievementPct.toFixed(1)}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.isCommission || metric.isSpiff ? (
                          <Badge variant="outline" className="font-mono">{metric.rate}%</Badge>
                        ) : metric.isNrr ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <Badge variant={metric.multiplier > 1 ? "default" : metric.multiplier === 0 ? "destructive" : "secondary"} className="font-mono">
                            {metric.multiplier.toFixed(2)}x
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">{formatCurrency(metric.payout)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(bookingAmt)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(collectionAmt)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(yearEndAmt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{metric.logicType.replace("_", " ")}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/10">
                  <TableCell colSpan={4} className="font-bold text-primary">Total Projected Payout</TableCell>
                  <TableCell className="text-right font-bold text-xl text-primary">{formatCurrency(totalSimulatedPayout)}</TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        {/* Comparison with current */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm text-muted-foreground">Current Total Payout</p>
            <p className="text-lg font-semibold">{formatCurrency(currentTotalPayout)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Simulated Difference</p>
            <p className={`text-lg font-semibold ${totalSimulatedPayout >= currentTotalPayout ? "text-success" : "text-destructive"}`}>
              {totalSimulatedPayout >= currentTotalPayout ? "+" : ""}
              {formatCurrency(totalSimulatedPayout - currentTotalPayout)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
