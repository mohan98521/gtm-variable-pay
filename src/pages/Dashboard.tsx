import { AppLayout } from "@/components/layout/AppLayout";
import { MetricsTable } from "@/components/dashboard/MetricsTable";
import { MonthlyPerformanceTable } from "@/components/dashboard/MonthlyPerformanceTable";
import { CommissionTable } from "@/components/dashboard/CommissionTable";
import { PayoutSimulator } from "@/components/dashboard/PayoutSimulator";
import { StaffLandingPage } from "@/components/dashboard/StaffLandingPage";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { NRRSummaryCard } from "@/components/dashboard/NRRSummaryCard";
import { SpiffSummaryCard } from "@/components/dashboard/SpiffSummaryCard";
import { CollectionStatusCard } from "@/components/dashboard/CollectionStatusCard";
import { Calendar, Loader2, Target, DollarSign, Briefcase, Info, Layers, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUserCompensation } from "@/hooks/useCurrentUserCompensation";
import { useDashboardPayoutSummary } from "@/hooks/useDashboardPayoutSummary";
import { formatCurrencyValue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { data: compensation, isLoading, error } = useCurrentUserCompensation();
  const { data: payoutSummary, isLoading: payoutLoading } = useDashboardPayoutSummary();

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
        <StaffLandingPage />
      </AppLayout>
    );
  }

  const formatCurrency = (value: number) => formatCurrencyValue(value);

  // Use payout run data when available, otherwise fall back to calculated values
  const usePayoutData = payoutSummary?.isFromPayoutRun === true;
  
  const grandTotalEligible = usePayoutData
    ? payoutSummary.totalEligible
    : compensation.totalEligiblePayout + compensation.totalCommissionPayout;
  
  const grandTotalPaid = usePayoutData
    ? payoutSummary.totalPaid
    : compensation.totalPaid + compensation.totalCommissionPaid;
  
  const grandTotalHoldback = usePayoutData
    ? payoutSummary.totalHolding
    : compensation.totalHoldback + compensation.totalCommissionHoldback;
  
  const commissionTotal = usePayoutData
    ? payoutSummary.totalCommission
    : compensation.totalCommissionPayout;

  const dataSourceLabel = usePayoutData ? "Finalized" : "Estimated";
  const dataSourceTooltip = usePayoutData
    ? `Based on finalized payout runs (${payoutSummary.monthsCovered} month${payoutSummary.monthsCovered !== 1 ? 's' : ''})`
    : "Estimated from real-time calculation. Run payouts to finalize.";

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
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/reports">
              <Button variant="outline" size="sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Payout Statement
              </Button>
            </Link>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant={usePayoutData ? "default" : "secondary"}
                    className={usePayoutData 
                      ? "bg-success text-success-foreground" 
                      : ""}
                  >
                    <Info className="mr-1 h-3 w-3" />
                    {dataSourceLabel}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{dataSourceTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          <MetricCard
            title="Target Bonus"
            value={formatCurrency(compensation.targetBonusUsd)}
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            title="Total Eligible"
            value={formatCurrency(grandTotalEligible)}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Amount Paid"
            value={formatCurrency(grandTotalPaid)}
            icon={<DollarSign className="h-5 w-5" />}
            variant="accent"
          />
          <MetricCard
            title="Holding"
            value={formatCurrency(grandTotalHoldback)}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            title="Commission"
            value={formatCurrency(commissionTotal)}
            icon={<Briefcase className="h-5 w-5" />}
          />
        </div>

        {/* Blended Target Info for Multi-Assignment Years */}
        {payoutSummary?.assignmentSegments && payoutSummary.assignmentSegments.length > 1 && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Assignment Periods
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {payoutSummary.assignmentSegments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(parseISO(seg.startDate), 'MMM yyyy')} – {format(parseISO(seg.endDate), 'MMM yyyy')}:
                      <span className="ml-1.5 font-medium text-foreground">{seg.planName}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {seg.oteUsd != null && <>OTE {formatCurrency(seg.oteUsd)}</>}
                      {seg.oteUsd != null && seg.targetBonusUsd != null && <> | </>}
                      {seg.targetBonusUsd != null && <>Target Bonus {formatCurrency(seg.targetBonusUsd)}</>}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table 1: Variable Pay Metrics Summary */}
        <MetricsTable
          metrics={compensation.metrics}
          totalEligiblePayout={compensation.totalEligiblePayout}
          totalPaid={compensation.totalPaid}
          totalHoldback={compensation.totalHoldback}
          totalYearEndHoldback={compensation.totalYearEndHoldback}
          clawbackAmount={compensation.clawbackAmount}
        />

        {/* Table 2: Commission Structure Summary */}
        <CommissionTable
          commissions={compensation.commissions}
          totalGrossPayout={compensation.totalCommissionPayout}
          totalPaid={compensation.totalCommissionPaid}
          totalHoldback={compensation.totalCommissionHoldback}
          totalYearEndHoldback={compensation.totalCommissionYearEndHoldback}
        />

        {/* Collection Status */}
        {compensation.dealCollections.length > 0 && (
          <CollectionStatusCard dealCollections={compensation.dealCollections} />
        )}

        {/* NRR Additional Pay */}
        {compensation.nrrOtePct > 0 && compensation.nrrResult && (
          <NRRSummaryCard nrrResult={compensation.nrrResult} nrrOtePct={compensation.nrrOtePct} />
        )}

        {/* SPIFF Summary */}
        {compensation.spiffResult && compensation.spiffResult.totalSpiffUsd > 0 && (
          <SpiffSummaryCard spiffResult={compensation.spiffResult} />
        )}

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
