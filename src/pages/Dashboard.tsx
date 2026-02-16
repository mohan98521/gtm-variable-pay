import { AppLayout } from "@/components/layout/AppLayout";
import { MetricsTable } from "@/components/dashboard/MetricsTable";
import { MonthlyPerformanceTable } from "@/components/dashboard/MonthlyPerformanceTable";
import { CommissionTable } from "@/components/dashboard/CommissionTable";
import { PayoutSimulator } from "@/components/dashboard/PayoutSimulator";
import { StaffLandingPage } from "@/components/dashboard/StaffLandingPage";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { NRRSummaryCard } from "@/components/dashboard/NRRSummaryCard";
import { SpiffSummaryCard } from "@/components/dashboard/SpiffSummaryCard";
import { Calendar, Loader2, Target, DollarSign, Briefcase, Layers, FileText, BookOpen, Clock, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardPayoutRunData } from "@/hooks/useDashboardPayoutRunData";
import { useCurrentUserCompensation } from "@/hooks/useCurrentUserCompensation";
import { formatCurrencyValue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Calculating: "bg-muted text-muted-foreground",
  Review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Finalized: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Paid: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/40 dark:text-emerald-300",
};

export default function Dashboard() {
  const { data: payoutData, isLoading: payoutLoading, error: payoutError } = useDashboardPayoutRunData();
  const { data: compensation, isLoading: compLoading, error: compError } = useCurrentUserCompensation();

  const isLoading = payoutLoading || compLoading;
  const error = payoutError || compError;

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
            <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!compensation && !payoutData?.hasPayoutData) {
    return (
      <AppLayout>
        <StaffLandingPage />
      </AppLayout>
    );
  }

  const formatCurrency = (value: number) => formatCurrencyValue(value);

  const hasPayoutRun = payoutData?.hasPayoutData === true;
  
  const employeeName = hasPayoutRun ? payoutData.employeeName : compensation?.employeeName || "User";
  const fiscalYear = hasPayoutRun ? payoutData.fiscalYear : compensation?.fiscalYear || new Date().getFullYear();
  const currentPlanName = hasPayoutRun ? payoutData.planName : compensation?.planName || "No Plan";
  const targetBonus = hasPayoutRun ? payoutData.targetBonusUsd : compensation?.targetBonusUsd || 0;

  // Bifurcated YTD totals (Issue 1)
  const ytdTotalEligible = hasPayoutRun
    ? payoutData.ytdTotalEligible
    : (compensation?.totalEligiblePayout || 0) + (compensation?.totalCommissionPayout || 0);
  const ytdBookingUsd = hasPayoutRun
    ? payoutData.ytdBookingUsd
    : (compensation?.totalPaid || 0) + (compensation?.totalCommissionPaid || 0);
  const ytdCollectionUsd = hasPayoutRun
    ? payoutData.ytdCollectionUsd
    : (compensation?.totalHoldback || 0) + (compensation?.totalCommissionHoldback || 0);
  const ytdYearEndUsd = hasPayoutRun
    ? payoutData.ytdYearEndUsd
    : (compensation?.totalYearEndHoldback || 0) + (compensation?.totalCommissionYearEndHoldback || 0);

  // Metrics for tables
  const metricsForTable = hasPayoutRun
    ? payoutData.vpMetrics.map(m => ({
        metricName: m.metricName,
        targetValue: m.targetUsd,
        actualValue: m.actualUsd,
        achievementPct: m.achievementPct,
        weightagePercent: m.weightagePercent,
        allocation: m.allocatedOteUsd,
        multiplier: m.multiplier,
        eligiblePayout: m.ytdEligibleUsd,
        amountPaid: m.bookingUsd,
        holdback: m.collectionUsd,
        yearEndHoldback: m.yearEndUsd,
        logicType: m.logicType,
        gateThreshold: m.gateThreshold,
        multiplierGrids: [],
        payoutOnBookingPct: m.payoutOnBookingPct,
        payoutOnCollectionPct: m.payoutOnCollectionPct,
        payoutOnYearEndPct: m.payoutOnYearEndPct,
      }))
    : compensation?.metrics || [];

  const commissionsForTable = hasPayoutRun
    ? payoutData.commissions.map(c => ({
        commissionType: c.commissionType,
        dealValue: c.dealValueUsd,
        rate: c.ratePct,
        minThreshold: c.minThreshold,
        grossPayout: c.grossPayoutUsd,
        amountPaid: c.bookingUsd,
        holdback: c.collectionUsd,
        yearEndHoldback: c.yearEndUsd,
        payoutOnBookingPct: c.payoutOnBookingPct,
        payoutOnCollectionPct: c.payoutOnCollectionPct,
        payoutOnYearEndPct: c.payoutOnYearEndPct,
      }))
    : compensation?.commissions || [];

  const vpEligibleTotal = hasPayoutRun
    ? payoutData.vpMetrics.reduce((s, m) => s + m.ytdEligibleUsd, 0)
    : compensation?.totalEligiblePayout || 0;
  const vpPaidTotal = hasPayoutRun
    ? payoutData.vpMetrics.reduce((s, m) => s + m.bookingUsd, 0)
    : compensation?.totalPaid || 0;
  const vpHoldbackTotal = hasPayoutRun
    ? payoutData.vpMetrics.reduce((s, m) => s + m.collectionUsd, 0)
    : compensation?.totalHoldback || 0;
  const vpYearEndTotal = hasPayoutRun
    ? payoutData.vpMetrics.reduce((s, m) => s + m.yearEndUsd, 0)
    : compensation?.totalYearEndHoldback || 0;

  const commGrossTotal = hasPayoutRun
    ? payoutData.commissions.reduce((s, c) => s + c.grossPayoutUsd, 0)
    : compensation?.totalCommissionPayout || 0;
  const commPaidTotal = hasPayoutRun
    ? payoutData.commissions.reduce((s, c) => s + c.bookingUsd, 0)
    : compensation?.totalCommissionPaid || 0;
  const commHoldbackTotal = hasPayoutRun
    ? payoutData.commissions.reduce((s, c) => s + c.collectionUsd, 0)
    : compensation?.totalCommissionHoldback || 0;
  const commYearEndTotal = hasPayoutRun
    ? payoutData.commissions.reduce((s, c) => s + c.yearEndUsd, 0)
    : compensation?.totalCommissionYearEndHoldback || 0;

  const clawbackAmount = hasPayoutRun ? payoutData.clawbackAmount : compensation?.clawbackAmount || 0;
  const assignmentSegments = hasPayoutRun ? payoutData.assignmentSegments : [];

  const runStatus = payoutData?.payoutRunStatus;
  const statusLabel = runStatus?.runStatus || (hasPayoutRun ? "Finalized" : "Estimated");
  const statusColor = STATUS_COLORS[statusLabel] || STATUS_COLORS.Draft;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {employeeName}
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
                  <Badge className={`${statusColor} border-0`}>
                    {statusLabel}
                    {runStatus && (
                      <span className="ml-1 opacity-75">
                        ({runStatus.monthsCovered} mo)
                      </span>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {hasPayoutRun
                      ? `Latest payout run status: ${statusLabel} — ${runStatus?.monthsCovered || 0} month(s) processed`
                      : "No payout runs found. Showing estimated calculations."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              FY {fiscalYear}
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {currentPlanName}
            </Badge>
          </div>
        </div>

        {/* Summary Cards - Bifurcated (Issue 1) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Target Bonus"
            value={formatCurrency(targetBonus)}
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            title="YTD Total Eligible"
            value={formatCurrency(ytdTotalEligible)}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Payable (Booking)"
            value={formatCurrency(ytdBookingUsd)}
            icon={<BookOpen className="h-5 w-5" />}
            variant="accent"
          />
          <MetricCard
            title="Payable Upon Collection"
            value={formatCurrency(ytdCollectionUsd)}
            icon={<Clock className="h-5 w-5" />}
          />
          <MetricCard
            title="Hold Till Year End"
            value={formatCurrency(ytdYearEndUsd)}
            icon={<CalendarClock className="h-5 w-5" />}
          />
        </div>

        {/* Assignment Periods */}
        {assignmentSegments.length > 1 && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Assignment Periods
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {assignmentSegments.map((seg, i) => (
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

        {/* Metric-wise Performance Summary */}
        <MetricsTable
          metrics={metricsForTable}
          totalEligiblePayout={vpEligibleTotal}
          totalPaid={vpPaidTotal}
          totalHoldback={vpHoldbackTotal}
          totalYearEndHoldback={vpYearEndTotal}
          clawbackAmount={clawbackAmount}
        />

        {/* Commission Structure Summary */}
        <CommissionTable
          commissions={commissionsForTable}
          totalGrossPayout={commGrossTotal}
          totalPaid={commPaidTotal}
          totalHoldback={commHoldbackTotal}
          totalYearEndHoldback={commYearEndTotal}
        />

        {/* (CR/ER + Implementation) */}
        {hasPayoutRun && payoutData.nrrSummary && (
          <NRRSummaryCard nrrSummary={payoutData.nrrSummary} />
        )}
        {!hasPayoutRun && compensation?.nrrOtePct && compensation.nrrOtePct > 0 && compensation.nrrResult && (
          <NRRSummaryCard nrrSummary={{
            nrrTarget: compensation.nrrResult.nrrTarget,
            nrrActuals: compensation.nrrResult.nrrActuals,
            achievementPct: compensation.nrrResult.achievementPct,
            payoutUsd: compensation.nrrResult.payoutUsd,
            eligibleCrErUsd: compensation.nrrResult.eligibleCrErUsd,
            totalCrErUsd: compensation.nrrResult.totalCrErUsd,
            eligibleImplUsd: compensation.nrrResult.eligibleImplUsd,
            totalImplUsd: compensation.nrrResult.totalImplUsd,
            nrrOtePct: compensation.nrrOtePct,
          }} />
        )}

        {/* SPIFF Summary */}
        {hasPayoutRun && payoutData.spiffSummary && (
          <SpiffSummaryCard spiffSummary={payoutData.spiffSummary} />
        )}
        {!hasPayoutRun && compensation?.spiffResult && compensation.spiffResult.totalSpiffUsd > 0 && (
          <SpiffSummaryCard spiffSummary={{
            totalSpiffUsd: compensation.spiffResult.totalSpiffUsd,
            softwareVariableOteUsd: compensation.spiffResult.softwareVariableOteUsd,
            softwareTargetUsd: compensation.spiffResult.softwareTargetUsd,
            eligibleActualsUsd: compensation.spiffResult.eligibleActualsUsd,
            spiffRatePct: compensation.spiffResult.spiffRatePct,
            achievementPct: 0,
          }} />
        )}

        {/* Monthly Performance Breakdown */}
        {hasPayoutRun ? (
          <MonthlyPerformanceTable
            monthlyActuals={payoutData.monthlyActuals}
            metricNames={payoutData.metricNames}
            metricTargets={payoutData.metricTargets}
          />
        ) : compensation?.monthlyBreakdown && (
          <MonthlyPerformanceTable
            monthlyActuals={compensation.monthlyBreakdown.map(m => ({
              month: m.month,
              monthLabel: m.monthLabel,
              metrics: {
                "New Software Booking ARR": m.newSoftwareArr,
                "Closing ARR": m.closingArr,
              },
            }))}
            metricNames={["New Software Booking ARR", "Closing ARR"]}
            metricTargets={{}}
          />
        )}

        {/* What-If Simulator */}
        <PayoutSimulator
          metrics={metricsForTable}
          commissions={commissionsForTable}
          planMetrics={compensation?.planMetrics || []}
          targetBonusUsd={targetBonus}
          planConfig={hasPayoutRun ? payoutData.planConfig : null}
          nrrSummary={hasPayoutRun ? payoutData.nrrSummary : null}
          spiffSummary={hasPayoutRun ? payoutData.spiffSummary : null}
        />
      </div>
    </AppLayout>
  );
}
