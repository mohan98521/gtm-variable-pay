import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, Target } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import type { ExecutiveDashboardData } from "@/hooks/useExecutiveDashboard";

interface NorthStarCardsProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function NorthStarCards({ data, isLoading }: NorthStarCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const attainmentData = [{ value: Math.min(data.globalQuotaAttainment, 150), fill: "hsl(var(--accent))" }];
  const budgetPct = Math.min(data.payoutVsBudgetPct, 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Eligible Payout */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-1">
            <DollarSign className="h-4 w-4" />
            Total Eligible Payout (YTD)
          </div>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {formatCompact(data.totalPayoutYtd)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.payoutVsBudgetPct.toFixed(0)}% of Budget ({formatCompact(data.totalBudget)})
          </div>
        </CardContent>
      </Card>

      {/* Global Quota Attainment - Radial */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-1">
            <Target className="h-4 w-4" />
            Global Quota Attainment
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  barSize={8}
                  data={attainmentData}
                  startAngle={90}
                  endAngle={90 - (360 * Math.min(data.globalQuotaAttainment, 150)) / 150}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={4}
                    background={{ fill: "hsl(var(--muted))" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-foreground">{data.globalQuotaAttainment.toFixed(0)}%</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Weighted avg across all reps
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payout vs Budget */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-1">
            <DollarSign className="h-4 w-4" />
            Payout vs. Budget
          </div>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {budgetPct.toFixed(0)}%
          </div>
          <Progress value={budgetPct} className="mt-3 h-2" />
          <div className="text-xs text-muted-foreground mt-1">
            {formatCompact(data.totalPayoutYtd)} of {formatCompact(data.totalBudget)}
          </div>
        </CardContent>
      </Card>

      {/* Active Payees */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-1">
            <Users className="h-4 w-4" />
            Eligible Payees
          </div>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {data.activePayees}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            With finalized payouts this year
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
