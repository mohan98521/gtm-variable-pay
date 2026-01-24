import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Target, DollarSign, TrendingUp, Award, Calendar, ArrowUpRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserTarget, useCurrentUserProfile } from "@/hooks/useCurrentUserTarget";
import { useLatestExchangeRate } from "@/hooks/useExchangeRates";
import { calculateProRation, getBonusSplit } from "@/lib/compensation";

export default function Dashboard() {
  const { data: userTarget, isLoading: targetLoading } = useCurrentUserTarget();
  const { data: profile, isLoading: profileLoading } = useCurrentUserProfile();
  const { data: exchangeRate } = useLatestExchangeRate(profile?.local_currency);

  const isLoading = targetLoading || profileLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Calculate pro-rated values
  const proRation = userTarget ? calculateProRation({
    effectiveStartDate: userTarget.effective_start_date,
    effectiveEndDate: userTarget.effective_end_date,
    targetBonusUSD: userTarget.target_bonus_usd ?? 0,
  }) : null;

  const annualTarget = userTarget?.target_value_annual ?? 0;
  const proRatedTargetBonus = proRation?.proRatedTargetBonusUSD ?? 0;
  const proRationPercent = proRation ? Math.round(proRation.proRationFactor * 100) : 100;
  
  // Get bonus split for the user's sales function
  const bonusSplit = getBonusSplit(profile?.sales_function);
  
  // Calculate targets by metric
  const newSoftwareTarget = annualTarget * (bonusSplit.newSoftwareBookingARR / 100);
  const closingARRTarget = annualTarget * (bonusSplit.closingARR / 100);

  // Mock YTD achieved values (will be replaced with actual data from monthly_actuals)
  const ytdAchievedPct = 77.5; // This would come from actual performance data
  const ytdAchieved = annualTarget * (ytdAchievedPct / 100);
  
  // Calculate current payout estimate
  const currentPayoutEstimate = proRatedTargetBonus * (ytdAchievedPct / 100);

  const achievementPct = annualTarget > 0 ? (ytdAchieved / annualTarget) * 100 : 0;
  
  // Determine pace status based on YTD progress
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedPct = (monthsElapsed / 12) * 100;
  const paceStatus = achievementPct >= expectedPct ? "on-track" : achievementPct >= expectedPct * 0.85 ? "at-risk" : "behind";

  const planName = userTarget?.comp_plans?.name ?? "No Plan Assigned";
  const fiscalYear = new Date().getFullYear();

  // Metrics breakdown
  const metrics = [
    { 
      name: "New Software Booking ARR", 
      target: newSoftwareTarget, 
      achieved: newSoftwareTarget * 0.82, // Mock: replace with actual
      weight: bonusSplit.newSoftwareBookingARR 
    },
    { 
      name: "Closing ARR", 
      target: closingARRTarget, 
      achieved: closingARRTarget * 0.71, // Mock: replace with actual
      weight: bonusSplit.closingARR 
    },
  ].filter(m => m.weight > 0);

  // Mock monthly trend (will be replaced with actual data)
  const monthlyTrend = [
    { month: "Jan", achieved: annualTarget * 0.07 },
    { month: "Feb", achieved: annualTarget * 0.084 },
    { month: "Mar", achieved: annualTarget * 0.076 },
    { month: "Apr", achieved: annualTarget * 0.11 },
    { month: "May", achieved: annualTarget * 0.096 },
    { month: "Jun", achieved: annualTarget * 0.124 },
    { month: "Jul", achieved: annualTarget * 0.105 },
    { month: "Aug", achieved: annualTarget * 0.11 },
  ];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Your variable compensation overview</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              FY {fiscalYear}
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {planName}
            </Badge>
            {proRationPercent < 100 && (
              <Badge variant="secondary">
                {proRationPercent}% Pro-rated
              </Badge>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Annual Target"
            value={`$${annualTarget.toLocaleString()}`}
            subtitle={proRationPercent < 100 ? `Pro-rated: $${Math.round(annualTarget * proRation!.proRationFactor).toLocaleString()}` : undefined}
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            title="YTD Achieved"
            value={`$${Math.round(ytdAchieved).toLocaleString()}`}
            subtitle={`${achievementPct.toFixed(1)}% of annual target`}
            trend="up"
            trendValue="+12.5% vs last month"
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Estimated Payout"
            value={`$${Math.round(currentPayoutEstimate).toLocaleString()}`}
            subtitle={`Target bonus: $${Math.round(proRatedTargetBonus).toLocaleString()}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="accent"
          />
          <MetricCard
            title="Achievement Rate"
            value={`${achievementPct.toFixed(0)}%`}
            subtitle={paceStatus === "on-track" ? "On track to target" : paceStatus === "at-risk" ? "At risk" : "Behind target"}
            icon={<Award className="h-5 w-5" />}
            variant={paceStatus === "on-track" ? "success" : paceStatus === "at-risk" ? "warning" : "default"}
          />
        </div>

        {/* Metrics Breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Individual Metrics */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Metrics Breakdown</CardTitle>
              <CardDescription>Performance by compensation metric</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {metrics.map((metric) => {
                const metricPct = metric.target > 0 ? (metric.achieved / metric.target) * 100 : 0;
                return (
                  <div key={metric.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{metric.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Weight: {metric.weight}% • Target: ${metric.target.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">${Math.round(metric.achieved).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{metricPct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <ProgressBar value={metric.achieved} max={metric.target} size="md" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Monthly Performance</CardTitle>
              <CardDescription>Achievement trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyTrend.map((month, idx) => {
                  const maxValue = Math.max(...monthlyTrend.map(m => m.achieved));
                  const widthPct = maxValue > 0 ? (month.achieved / maxValue) * 100 : 0;
                  const prevMonth = monthlyTrend[idx - 1];
                  const growth = prevMonth && prevMonth.achieved > 0 
                    ? ((month.achieved - prevMonth.achieved) / prevMonth.achieved) * 100 
                    : 0;

                  return (
                    <div key={month.month} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium text-muted-foreground">{month.month}</span>
                      <div className="flex-1">
                        <div className="h-6 rounded bg-muted">
                          <div
                            className="h-6 rounded bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <span className="text-sm font-medium text-foreground">
                          ${Math.round(month.achieved).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-16 text-right">
                        {idx > 0 && (
                          <span className={`text-xs ${growth >= 0 ? "text-success" : "text-destructive"}`}>
                            {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout Projection */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-foreground">Payout Projection</CardTitle>
                <CardDescription>Based on current performance trajectory</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-accent">
                <ArrowUpRight className="h-5 w-5" />
                <span className="text-lg font-semibold">${Math.round(currentPayoutEstimate * 1.5).toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">projected annual</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4 border border-border/30">
                <p className="text-sm text-muted-foreground">If achieving 100%</p>
                <p className="mt-1 text-xl font-semibold text-foreground">${Math.round(proRatedTargetBonus).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">1.0x multiplier</p>
              </div>
              <div className="rounded-lg bg-accent/10 p-4 border border-accent/30">
                <p className="text-sm text-accent">If achieving 120%</p>
                <p className="mt-1 text-xl font-semibold text-accent">${Math.round(proRatedTargetBonus * 1.44).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">1.44x multiplier (accelerator)</p>
              </div>
              <div className="rounded-lg bg-success/10 p-4 border border-success/30">
                <p className="text-sm text-success">If achieving 150%</p>
                <p className="mt-1 text-xl font-semibold text-success">${Math.round(proRatedTargetBonus * 2.25).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">2.25x multiplier (accelerator)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency Info */}
        {profile?.local_currency && profile.local_currency !== 'USD' && exchangeRate && (
          <div className="text-sm text-muted-foreground text-center">
            Values shown in USD. Your local currency: {profile.local_currency} (1 {profile.local_currency} = ${exchangeRate.rate_to_usd?.toFixed(4)} USD)
          </div>
        )}
      </div>
    </AppLayout>
  );
}
