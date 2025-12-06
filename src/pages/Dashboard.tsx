import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Target, DollarSign, TrendingUp, Award, Calendar, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const mockData = {
  annualTarget: 500000,
  ytdAchieved: 387500,
  currentPayout: 42500,
  planName: "Hunter 2025",
  metrics: [
    { name: "New Software Sales", target: 300000, achieved: 245000, weight: 60 },
    { name: "Closing ARR", target: 200000, achieved: 142500, weight: 40 },
  ],
  monthlyTrend: [
    { month: "Jan", achieved: 35000 },
    { month: "Feb", achieved: 42000 },
    { month: "Mar", achieved: 38000 },
    { month: "Apr", achieved: 55000 },
    { month: "May", achieved: 48000 },
    { month: "Jun", achieved: 62000 },
    { month: "Jul", achieved: 52500 },
    { month: "Aug", achieved: 55000 },
  ],
};

export default function Dashboard() {
  const achievementPct = (mockData.ytdAchieved / mockData.annualTarget) * 100;
  const ytdTarget = (mockData.annualTarget / 12) * 8; // 8 months of the year
  const paceStatus = mockData.ytdAchieved >= ytdTarget ? "on-track" : mockData.ytdAchieved >= ytdTarget * 0.85 ? "at-risk" : "behind";

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
              FY 2025
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {mockData.planName}
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Annual Target"
            value={`$${mockData.annualTarget.toLocaleString()}`}
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            title="YTD Achieved"
            value={`$${mockData.ytdAchieved.toLocaleString()}`}
            subtitle={`${achievementPct.toFixed(1)}% of annual target`}
            trend="up"
            trendValue="+12.5% vs last month"
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Current Payout"
            value={`$${mockData.currentPayout.toLocaleString()}`}
            subtitle="Estimated earnings"
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metrics Breakdown</CardTitle>
              <CardDescription>Performance by compensation metric</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {mockData.metrics.map((metric) => {
                const metricPct = (metric.achieved / metric.target) * 100;
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
                        <p className="font-semibold text-foreground">${metric.achieved.toLocaleString()}</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Performance</CardTitle>
              <CardDescription>Achievement trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockData.monthlyTrend.map((month, idx) => {
                  const maxValue = Math.max(...mockData.monthlyTrend.map(m => m.achieved));
                  const widthPct = (month.achieved / maxValue) * 100;
                  const prevMonth = mockData.monthlyTrend[idx - 1];
                  const growth = prevMonth ? ((month.achieved - prevMonth.achieved) / prevMonth.achieved) * 100 : 0;

                  return (
                    <div key={month.month} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium text-muted-foreground">{month.month}</span>
                      <div className="flex-1">
                        <div className="h-6 rounded bg-muted">
                          <div
                            className="h-6 rounded bg-primary transition-all duration-500"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <span className="text-sm font-medium text-foreground">
                          ${month.achieved.toLocaleString()}
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Payout Projection</CardTitle>
                <CardDescription>Based on current performance trajectory</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-accent">
                <ArrowUpRight className="h-5 w-5" />
                <span className="text-lg font-semibold">${(mockData.currentPayout * 1.5).toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">projected annual</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">If achieving 100%</p>
                <p className="mt-1 text-xl font-semibold text-foreground">$50,000</p>
                <p className="text-xs text-muted-foreground">1.0x multiplier</p>
              </div>
              <div className="rounded-md bg-accent/10 p-4 border border-accent/20">
                <p className="text-sm text-accent">If achieving 120%</p>
                <p className="mt-1 text-xl font-semibold text-accent">$72,000</p>
                <p className="text-xs text-muted-foreground">1.44x multiplier (accelerator)</p>
              </div>
              <div className="rounded-md bg-success/10 p-4 border border-success/20">
                <p className="text-sm text-success">If achieving 150%</p>
                <p className="mt-1 text-xl font-semibold text-success">$112,500</p>
                <p className="text-xs text-muted-foreground">2.25x multiplier (accelerator)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}