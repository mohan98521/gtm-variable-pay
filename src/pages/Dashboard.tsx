import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Target, DollarSign, TrendingUp, Award, Calendar, ArrowUpRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserTarget";
import { useUserPlanConfiguration } from "@/hooks/useUserPlanConfiguration";
import { useLatestExchangeRate } from "@/hooks/useExchangeRates";
import { useUserActuals } from "@/hooks/useUserActuals";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { calculateProRation } from "@/lib/compensation";
import { generatePayoutProjections, calculateVariablePayFromPlan, MetricActual } from "@/lib/compensationEngine";

export default function Dashboard() {
  const { selectedYear } = useFiscalYear();
  const { data: planConfig, isLoading: planLoading } = useUserPlanConfiguration();
  const { data: profile, isLoading: profileLoading } = useCurrentUserProfile();
  const { data: exchangeRate } = useLatestExchangeRate(profile?.local_currency);
  const { data: actualsData, isLoading: actualsLoading } = useUserActuals();

  const isLoading = planLoading || profileLoading || actualsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Calculate pro-rated values using plan configuration
  const proRation = planConfig ? calculateProRation({
    effectiveStartDate: planConfig.effectiveStartDate,
    effectiveEndDate: planConfig.effectiveEndDate,
    targetBonusUSD: planConfig.targetBonusUsd ?? 0,
  }) : null;

  const annualTarget = planConfig?.targetValueAnnual ?? 0;
  const proRatedTargetBonus = proRation?.proRatedTargetBonusUSD ?? 0;
  const proRationPercent = proRation ? Math.round(proRation.proRationFactor * 100) : 100;
  
  // Get actual values from the database
  const actualsMap = new Map<string, number>();
  (actualsData?.actuals || []).forEach(metric => {
    actualsMap.set(metric.metricName, metric.ytdTotal);
  });
  
  // Build metrics from plan configuration (database-driven)
  const metrics = (planConfig?.metrics || []).map(metric => {
    // Calculate target for this metric based on weightage
    const metricTarget = annualTarget * (metric.weightage_percent / 100);
    
    // Get actual from database actuals
    const achieved = actualsMap.get(metric.metric_name) || 0;
    
    return {
      id: metric.id,
      name: metric.metric_name,
      target: metricTarget,
      achieved,
      weight: metric.weightage_percent,
      logicType: metric.logic_type,
      gateThreshold: metric.gate_threshold_percent,
    };
  }).filter(m => m.weight > 0);

  // Calculate totals from metrics
  const totalAchieved = metrics.reduce((sum, m) => sum + m.achieved, 0);
  const ytdAchievedPct = annualTarget > 0 ? (totalAchieved / annualTarget) * 100 : 0;
  
  // Build metricsActuals for the compensation engine
  const metricsActuals: MetricActual[] = metrics.map(m => ({
    metricId: m.id,
    metricName: m.name,
    targetValue: m.target,
    actualValue: m.achieved,
  }));
  
  // Calculate current payout using the database-driven engine
  const currentPayoutResult = planConfig?.metrics 
    ? calculateVariablePayFromPlan({
        userId: planConfig.userId,
        planId: planConfig.planId,
        planName: planConfig.planName,
        targetBonusUSD: planConfig.targetBonusUsd ?? 0,
        proRatedTargetBonusUSD: proRatedTargetBonus,
        proRationFactor: proRation?.proRationFactor ?? 1,
        metrics: planConfig.metrics,
        metricsActuals,
      })
    : null;
  
  const currentPayoutEstimate = currentPayoutResult?.totalPayoutUSD ?? 0;

  const achievementPct = annualTarget > 0 ? (totalAchieved / annualTarget) * 100 : 0;
  
  // Determine pace status based on YTD progress
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedPct = (monthsElapsed / 12) * 100;
  const paceStatus = achievementPct >= expectedPct ? "on-track" : achievementPct >= expectedPct * 0.85 ? "at-risk" : "behind";

  const planName = planConfig?.planName ?? "No Plan Assigned";
  const fiscalYear = selectedYear;

  // Build monthly trend from actual data
  const buildMonthlyTrend = () => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = new Map<string, number>();
    
    // Aggregate all metric actuals by month
    (actualsData?.actuals || []).forEach(metric => {
      metric.monthlyActuals.forEach(ma => {
        const monthKey = ma.month; // YYYY-MM format
        const current = monthlyData.get(monthKey) || 0;
        monthlyData.set(monthKey, current + ma.value);
      });
    });
    
    // Convert to array and sort
    const sortedMonths = Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, achieved]) => {
        const monthIndex = parseInt(month.substring(5, 7), 10) - 1;
        return {
          month: monthNames[monthIndex] || month.substring(5, 7),
          achieved,
        };
      });
    
    return sortedMonths;
  };

  const monthlyTrend = buildMonthlyTrend();
  
  // Generate payout projections using database-driven calculation
  const projections = planConfig?.metrics 
    ? generatePayoutProjections(planConfig.metrics, proRatedTargetBonus, [100, 120, 150])
    : [
        { achievementLevel: 100, label: "100%", estimatedPayout: proRatedTargetBonus, averageMultiplier: 1.0 },
        { achievementLevel: 120, label: "120%", estimatedPayout: proRatedTargetBonus * 1.44, averageMultiplier: 1.44 },
        { achievementLevel: 150, label: "150%", estimatedPayout: proRatedTargetBonus * 2.25, averageMultiplier: 2.25 },
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
            value={`$${Math.round(totalAchieved).toLocaleString()}`}
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
              {metrics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No metrics configured for this plan.</p>
              ) : (
                metrics.map((metric) => {
                  const metricPct = metric.target > 0 ? (metric.achieved / metric.target) * 100 : 0;
                  return (
                    <div key={metric.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{metric.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Weight: {metric.weight}% • Target: ${metric.target.toLocaleString()}
                            {metric.gateThreshold && (
                              <span className="text-warning"> • Gate: {metric.gateThreshold}%</span>
                            )}
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
                })
              )}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Monthly Performance</CardTitle>
              <CardDescription>Achievement trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No monthly data available yet.</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payout Projection - Database-Driven */}
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
              {projections.map((proj, idx) => {
                const variants = [
                  { bg: "bg-muted/50", border: "border-border/30", text: "text-foreground" },
                  { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent" },
                  { bg: "bg-success/10", border: "border-success/30", text: "text-success" },
                ];
                const variant = variants[idx] || variants[0];
                
                return (
                  <div key={proj.achievementLevel} className={`rounded-lg ${variant.bg} p-4 border ${variant.border}`}>
                    <p className={`text-sm ${variant.text}`}>If achieving {proj.label}</p>
                    <p className={`mt-1 text-xl font-semibold ${variant.text}`}>
                      ${Math.round(proj.estimatedPayout).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proj.averageMultiplier.toFixed(2)}x average multiplier
                    </p>
                  </div>
                );
              })}
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
