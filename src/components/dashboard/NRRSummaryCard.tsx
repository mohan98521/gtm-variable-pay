import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { formatCurrencyValue } from "@/lib/utils";
import { NRRSummaryData } from "@/hooks/useDashboardPayoutRunData";
import { NRR_DISPLAY_NAME } from "@/lib/payoutTypes";

interface NRRSummaryCardProps {
  nrrSummary: NRRSummaryData;
}

export function NRRSummaryCard({ nrrSummary }: NRRSummaryCardProps) {
  const fmt = (v: number) => formatCurrencyValue(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          {NRR_DISPLAY_NAME}
          {nrrSummary.nrrOtePct > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {nrrSummary.nrrOtePct}% of Variable OTE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">NRR Target</p>
            <p className="text-sm font-semibold">{fmt(nrrSummary.nrrTarget)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible Actuals</p>
            <p className="text-sm font-semibold">{fmt(nrrSummary.nrrActuals)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Achievement</p>
            <p className="text-sm font-semibold">{nrrSummary.achievementPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NRR Payout</p>
            <p className="text-sm font-semibold text-success">{fmt(nrrSummary.payoutUsd)}</p>
          </div>
        </div>

        {/* CR/ER vs Implementation breakdown */}
        {(nrrSummary.totalCrErUsd > 0 || nrrSummary.totalImplUsd > 0) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">CR/ER</p>
              <p>Eligible: {fmt(nrrSummary.eligibleCrErUsd)} / {fmt(nrrSummary.totalCrErUsd)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Implementation</p>
              <p>Eligible: {fmt(nrrSummary.eligibleImplUsd)} / {fmt(nrrSummary.totalImplUsd)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
