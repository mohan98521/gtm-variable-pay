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
import { getMultiplierFromGrid } from "@/lib/compensationEngine";

interface PayoutSimulatorProps {
  metrics: MetricCompensation[];
  commissions: CommissionCompensation[];
  planMetrics: PlanMetric[];
  targetBonusUsd: number;
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
  rate?: number;
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

const formatInputValue = (value: number) => {
  return value.toString();
};

const parseInputValue = (value: string): number => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

export function PayoutSimulator({ metrics, commissions, planMetrics, targetBonusUsd }: PayoutSimulatorProps) {
  // Initialize with current actual values
  const [simulatedValues, setSimulatedValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    metrics.forEach(m => {
      initial[m.metricName] = m.actualValue;
    });
    commissions.forEach(c => {
      initial[c.commissionType] = c.dealValue;
    });
    return initial;
  });

  // Calculate simulated payouts
  const simulatedMetrics: SimulatedMetric[] = useMemo(() => {
    const results: SimulatedMetric[] = [];

    // Variable pay metrics
    metrics.forEach(metric => {
      const simulatedActual = simulatedValues[metric.metricName] || 0;
      const targetValue = metric.targetValue;
      const achievementPct = targetValue > 0 ? (simulatedActual / targetValue) * 100 : 0;
      const allocation = metric.allocation;

      // Find matching plan metric for multiplier calculation
      const planMetric = planMetrics.find(pm => pm.metric_name === metric.metricName);
      
      let multiplier = 1.0;
      if (planMetric) {
        multiplier = getMultiplierFromGrid(achievementPct, planMetric);
      } else if (metric.multiplierGrids && metric.multiplierGrids.length > 0) {
        const fakeMetric: PlanMetric = {
          id: "",
          plan_id: "",
          metric_name: metric.metricName,
          weightage_percent: metric.weightagePercent,
          logic_type: metric.logicType as any,
          gate_threshold_percent: metric.gateThreshold,
          payout_on_booking_pct: 75,
          payout_on_collection_pct: 25,
          created_at: "",
          multiplier_grids: metric.multiplierGrids,
        };
        multiplier = getMultiplierFromGrid(achievementPct, fakeMetric);
      }

      // Check gate threshold
      const isGated = metric.logicType === "Gated_Threshold";
      const belowGate = isGated && metric.gateThreshold && achievementPct <= metric.gateThreshold;
      const payout = belowGate ? 0 : (achievementPct / 100) * allocation * multiplier;

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
      });
    });

    // Commission metrics
    commissions.forEach(commission => {
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
        rate: commission.rate,
      });
    });

    return results;
  }, [metrics, commissions, planMetrics, simulatedValues]);

  const totalSimulatedPayout = simulatedMetrics.reduce((sum, m) => sum + m.payout, 0);
  const currentTotalPayout = metrics.reduce((sum, m) => sum + m.eligiblePayout, 0) +
    commissions.reduce((sum, c) => sum + c.grossPayout, 0);

  const handleInputChange = (metricName: string, value: string) => {
    setSimulatedValues(prev => ({
      ...prev,
      [metricName]: parseInputValue(value),
    }));
  };

  const resetToCurrentValues = () => {
    const reset: Record<string, number> = {};
    metrics.forEach(m => {
      reset[m.metricName] = m.actualValue;
    });
    commissions.forEach(c => {
      reset[c.commissionType] = c.dealValue;
    });
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
              Enter simulated actual values to see projected payouts
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToCurrentValues}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to current
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variable Pay Metrics Inputs */}
        {metrics.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Variable Pay Metrics
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.metricName} className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{metric.metricName}</Label>
                      <Badge variant="outline" className="text-xs">
                        {metric.weightagePercent}% weight
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: {formatCurrency(metric.targetValue)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={formatInputValue(simulatedValues[metric.metricName] || 0)}
                        onChange={(e) => handleInputChange(metric.metricName, e.target.value)}
                        className="font-mono"
                        placeholder="Enter simulated actual"
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Current: {formatCurrency(metric.actualValue)}
                      </span>
                      <span className="text-primary font-medium">
                        Achievement: {metric.targetValue > 0 
                          ? ((simulatedValues[metric.metricName] || 0) / metric.targetValue * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commission Metrics Inputs */}
        {commissions.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Commission Metrics
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {commissions.map((commission) => (
                <div key={commission.commissionType} className="p-4 rounded-lg border bg-card">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{commission.commissionType}</Label>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {commission.rate}% rate
                      </Badge>
                    </div>
                    {commission.minThreshold && (
                      <div className="text-xs text-muted-foreground">
                        Min Threshold: {formatCurrency(commission.minThreshold)}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="text"
                        value={formatInputValue(simulatedValues[commission.commissionType] || 0)}
                        onChange={(e) => handleInputChange(commission.commissionType, e.target.value)}
                        className="font-mono"
                        placeholder="Enter simulated deal value"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current: {formatCurrency(commission.dealValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results table */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Projected Payouts
          </h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Metric</TableHead>
                  <TableHead className="text-right font-semibold">Value</TableHead>
                  <TableHead className="text-right font-semibold">Achiev. %</TableHead>
                  <TableHead className="text-right font-semibold">Multiplier</TableHead>
                  <TableHead className="text-right font-semibold">Projected Payout</TableHead>
                  <TableHead className="font-semibold">Logic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulatedMetrics.map((metric) => (
                  <TableRow key={metric.metricName}>
                    <TableCell className="font-medium">{metric.metricName}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(metric.simulatedActual)}
                    </TableCell>
                    <TableCell className="text-right">
                      {metric.isCommission ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge 
                          variant={metric.achievementPct >= 100 ? "default" : "secondary"}
                          className="font-mono"
                        >
                          {metric.achievementPct.toFixed(1)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {metric.isCommission ? (
                        <Badge variant="outline" className="font-mono">
                          {metric.rate}%
                        </Badge>
                      ) : (
                        <Badge 
                          variant={metric.multiplier > 1 ? "default" : metric.multiplier === 0 ? "destructive" : "secondary"}
                          className="font-mono"
                        >
                          {metric.multiplier.toFixed(2)}x
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(metric.payout)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {metric.logicType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/10">
                  <TableCell colSpan={4} className="font-bold text-primary">
                    Total Projected Payout
                  </TableCell>
                  <TableCell className="text-right font-bold text-xl text-primary">
                    {formatCurrency(totalSimulatedPayout)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        {/* Comparison with current */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm text-muted-foreground">Current Total Payout</p>
            <p className="text-lg font-semibold">
              {formatCurrency(currentTotalPayout)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Simulated Difference</p>
            <p className={`text-lg font-semibold ${
              totalSimulatedPayout >= currentTotalPayout 
                ? "text-success" 
                : "text-destructive"
            }`}>
              {totalSimulatedPayout >= currentTotalPayout ? "+" : ""}
              {formatCurrency(totalSimulatedPayout - currentTotalPayout)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
