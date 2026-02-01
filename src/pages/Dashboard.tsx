import { AppLayout } from "@/components/layout/AppLayout";
import { MetricsTable } from "@/components/dashboard/MetricsTable";
import { MonthlyPerformanceTable } from "@/components/dashboard/MonthlyPerformanceTable";
import { CommissionTable } from "@/components/dashboard/CommissionTable";
import { PayoutSimulator } from "@/components/dashboard/PayoutSimulator";
import { Calendar, Loader2, UserCircle, Target, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUserCompensation } from "@/hooks/useCurrentUserCompensation";

export default function Dashboard() {
  const { data: compensation, isLoading, error } = useCurrentUserCompensation();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <p className="text-destructive font-medium">Error loading dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!compensation) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium">No compensation data found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please contact your administrator to set up your compensation plan.
            </p>
          </div>
        </div>
      </AppLayout>
    );
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

  const grandTotalEligible = compensation.totalEligiblePayout + compensation.totalCommissionPayout;
  const grandTotalPaid = compensation.totalPaid + compensation.totalCommissionPaid;
  const grandTotalHoldback = compensation.totalHoldback + compensation.totalCommissionHoldback;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {compensation.employeeName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              FY {compensation.fiscalYear}
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {compensation.planName}
            </Badge>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target Bonus</p>
                  <p className="text-xl font-semibold text-foreground">
                    {formatCurrency(compensation.targetBonusUsd)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Eligible</p>
                  <p className="text-xl font-semibold text-success">
                    {formatCurrency(grandTotalEligible)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <DollarSign className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid (75%)</p>
                  <p className="text-xl font-semibold text-foreground">
                    {formatCurrency(grandTotalPaid)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Holding (25%)</p>
                  <p className="text-xl font-semibold text-muted-foreground">
                    {formatCurrency(grandTotalHoldback)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Briefcase className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="text-xl font-semibold text-foreground">
                    {formatCurrency(compensation.totalCommissionPayout)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table 1: Variable Pay Metrics Summary */}
        <MetricsTable
          metrics={compensation.metrics}
          totalEligiblePayout={compensation.totalEligiblePayout}
          totalPaid={compensation.totalPaid}
          totalHoldback={compensation.totalHoldback}
          clawbackAmount={compensation.clawbackAmount}
        />

        {/* Table 2: Commission Structure Summary */}
        <CommissionTable
          commissions={compensation.commissions}
          totalGrossPayout={compensation.totalCommissionPayout}
          totalPaid={compensation.totalCommissionPaid}
          totalHoldback={compensation.totalCommissionHoldback}
        />

        {/* Table 3: Monthly Performance */}
        <MonthlyPerformanceTable monthlyBreakdown={compensation.monthlyBreakdown} />

        {/* Table 4: What-If Simulator */}
        <PayoutSimulator
          metrics={compensation.metrics}
          commissions={compensation.commissions}
          planMetrics={compensation.planMetrics}
          targetBonusUsd={compensation.targetBonusUsd}
        />
      </div>
    </AppLayout>
  );
}