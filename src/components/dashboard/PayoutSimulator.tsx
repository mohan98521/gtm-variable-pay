import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { PlanMetric } from "@/hooks/usePlanMetrics";
import { MetricCompensation } from "@/hooks/useCurrentUserCompensation";
import { getMultiplierFromGrid } from "@/lib/compensationEngine";

interface PayoutSimulatorProps {
  metrics: MetricCompensation[];
  planMetrics: PlanMetric[];
  targetBonusUsd: number;
}

interface SimulatedMetric {
  metricName: string;
  simulatedPct: number;
  allocation: number;
  multiplier: number;
  payout: number;
  logicType: string;
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

export function PayoutSimulator({ metrics, planMetrics, targetBonusUsd }: PayoutSimulatorProps) {
  // Initialize sliders with current achievement percentages
  const [simulatedValues, setSimulatedValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    metrics.forEach(m => {
      initial[m.metricName] = Math.max(80, Math.min(200, Math.round(m.achievementPct)));
    });
    return initial;
  });

  // Calculate simulated payouts using the compensation engine
  const simulatedMetrics: SimulatedMetric[] = useMemo(() => {
    return metrics.map(metric => {
      const simulatedPct = simulatedValues[metric.metricName] || 100;
      const allocation = metric.allocation;

      // Find matching plan metric for multiplier calculation
      const planMetric = planMetrics.find(pm => pm.metric_name === metric.metricName);
      
      let multiplier = 1.0;
      if (planMetric) {
        multiplier = getMultiplierFromGrid(simulatedPct, planMetric);
      } else if (metric.multiplierGrids && metric.multiplierGrids.length > 0) {
        // Use the metric's own grids
        const fakeMetric: PlanMetric = {
          id: "",
          plan_id: "",
          metric_name: metric.metricName,
          weightage_percent: metric.weightagePercent,
          logic_type: metric.logicType as any,
          gate_threshold_percent: metric.gateThreshold,
          created_at: "",
          multiplier_grids: metric.multiplierGrids,
        };
        multiplier = getMultiplierFromGrid(simulatedPct, fakeMetric);
      }

      // Check gate threshold
      const isGated = metric.logicType === "Gated_Threshold";
      const belowGate = isGated && metric.gateThreshold && simulatedPct <= metric.gateThreshold;
      const payout = belowGate ? 0 : (simulatedPct / 100) * allocation * multiplier;

      return {
        metricName: metric.metricName,
        simulatedPct,
        allocation,
        multiplier,
        payout,
        logicType: metric.logicType,
      };
    });
  }, [metrics, planMetrics, simulatedValues]);

  const totalSimulatedPayout = simulatedMetrics.reduce((sum, m) => sum + m.payout, 0);

  const handleSliderChange = (metricName: string, value: number[]) => {
    setSimulatedValues(prev => ({
      ...prev,
      [metricName]: value[0],
    }));
  };

  const resetToCurrentValues = () => {
    const reset: Record<string, number> = {};
    metrics.forEach(m => {
      reset[m.metricName] = Math.max(80, Math.min(200, Math.round(m.achievementPct)));
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
              Adjust achievement percentages to see projected payouts
            </CardDescription>
          </div>
          <button
            onClick={resetToCurrentValues}
            className="text-sm text-primary hover:underline"
          >
            Reset to current
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders for each metric */}
        <div className="grid gap-6 md:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.metricName} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{metric.metricName}</Label>
                <Badge variant="outline" className="font-mono">
                  {simulatedValues[metric.metricName] || 100}%
                </Badge>
              </div>
              <Slider
                value={[simulatedValues[metric.metricName] || 100]}
                onValueChange={(value) => handleSliderChange(metric.metricName, value)}
                min={80}
                max={200}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>80%</span>
                <span className="text-primary font-medium">
                  Current: {metric.achievementPct.toFixed(0)}%
                </span>
                <span>200%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Results table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold">Simulated %</TableHead>
                <TableHead className="text-right font-semibold">Allocation</TableHead>
                <TableHead className="text-right font-semibold">Multiplier</TableHead>
                <TableHead className="text-right font-semibold">Projected Payout</TableHead>
                <TableHead className="font-semibold">Logic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulatedMetrics.map((metric) => (
                <TableRow key={metric.metricName}>
                  <TableCell className="font-medium">{metric.metricName}</TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={metric.simulatedPct >= 100 ? "default" : "secondary"}
                      className="font-mono"
                    >
                      {metric.simulatedPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(metric.allocation)}
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

        {/* Comparison with current */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm text-muted-foreground">Current Eligible Payout</p>
            <p className="text-lg font-semibold">
              {formatCurrency(metrics.reduce((sum, m) => sum + m.eligiblePayout, 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Simulated Difference</p>
            <p className={`text-lg font-semibold ${
              totalSimulatedPayout >= metrics.reduce((sum, m) => sum + m.eligiblePayout, 0) 
                ? "text-success" 
                : "text-destructive"
            }`}>
              {totalSimulatedPayout >= metrics.reduce((sum, m) => sum + m.eligiblePayout, 0) ? "+" : ""}
              {formatCurrency(totalSimulatedPayout - metrics.reduce((sum, m) => sum + m.eligiblePayout, 0))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
