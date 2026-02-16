import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { formatCurrencyValue } from "@/lib/utils";
import { SpiffSummaryData } from "@/hooks/useDashboardPayoutRunData";

interface SpiffSummaryCardProps {
  spiffSummary: SpiffSummaryData;
}

export function SpiffSummaryCard({ spiffSummary }: SpiffSummaryCardProps) {
  const fmt = (v: number) => formatCurrencyValue(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          SPIFF Bonus
          <Badge variant="secondary" className="ml-auto text-xs">
            SPIFF Rate: {spiffSummary.spiffRatePct}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total SPIFF Payout</p>
            <p className="text-sm font-semibold text-success">{fmt(spiffSummary.totalSpiffUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Software Variable OTE</p>
            <p className="text-sm font-semibold">{fmt(spiffSummary.softwareVariableOteUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Software Target</p>
            <p className="text-sm font-semibold">{fmt(spiffSummary.softwareTargetUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible Actuals</p>
            <p className="text-sm font-semibold">{fmt(spiffSummary.eligibleActualsUsd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Achievement %</p>
            <p className="text-sm font-semibold">
              <Badge variant={spiffSummary.achievementPct >= 100 ? "default" : "secondary"} className="font-mono">
                {spiffSummary.achievementPct.toFixed(1)}%
              </Badge>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
