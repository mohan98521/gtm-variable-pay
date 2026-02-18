import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Download, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamCompensation } from "@/hooks/useTeamCompensation";
import { TeamSummaryCards } from "@/components/team/TeamSummaryCards";
import { TeamPerformanceTable } from "@/components/team/TeamPerformanceTable";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

export default function TeamView() {
  const { data, isLoading } = useTeamCompensation();
  const { selectedYear } = useFiscalYear();

  const handleExport = () => {
    if (!data?.members.length) return;

    const csvContent = generateCSV(data.members, [
      { key: "employeeName", header: "Employee Name" },
      { key: "designation", header: "Designation" },
      { key: "planName", header: "Comp Plan" },
      { key: "targetBonusUsd", header: "Target Bonus (USD)", getValue: (r) => r.targetBonusUsd },
      { key: "overallAchievementPct", header: "Achievement %", getValue: (r) => r.overallAchievementPct.toFixed(1) },
      { key: "totalEligiblePayout", header: "VP Eligible", getValue: (r) => r.totalEligiblePayout.toFixed(2) },
      { key: "totalPaid", header: "VP Paid (Booking)", getValue: (r) => r.totalPaid.toFixed(2) },
      { key: "totalHoldback", header: "VP Holdback (Collection)", getValue: (r) => r.totalHoldback.toFixed(2) },
      { key: "totalYearEndHoldback", header: "VP Year-End", getValue: (r) => r.totalYearEndHoldback.toFixed(2) },
      { key: "totalCommissionPayout", header: "Commission Gross", getValue: (r) => r.totalCommissionPayout.toFixed(2) },
      { key: "totalCommissionPaid", header: "Commission Paid", getValue: (r) => r.totalCommissionPaid.toFixed(2) },
      { key: "nrrPayout", header: "NRR Payout", getValue: (r) => (r.nrrResult?.payoutUsd || 0).toFixed(2) },
      { key: "spiffEarned", header: "SPIFF Earned", getValue: (r) => (r.spiffResult?.totalSpiffUsd || 0).toFixed(2) },
      { key: "clawback", header: "Clawback", getValue: (r) => r.clawbackAmount.toFixed(2) },
      { key: "status", header: "Status" },
    ]);

    downloadCSV(csvContent, `team-performance-FY${selectedYear}.csv`);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Team View</h1>
            <p className="text-muted-foreground">Monitor your direct reports' performance for FY {selectedYear}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data?.members.length}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        )}

        {/* No Employee ID Linked */}
        {!isLoading && !data && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium text-foreground">Account Not Linked</h2>
            <p className="text-muted-foreground max-w-md mt-1">
              Your account is not linked to an employee record. Contact your administrator to set up your profile.
            </p>
          </div>
        )}

        {/* Empty State - No direct reports */}
        {!isLoading && data && data.members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium text-foreground">No Direct Reports</h2>
            <p className="text-muted-foreground max-w-md mt-1">
              No team members are currently reporting to you. If this is unexpected, contact your administrator.
            </p>
          </div>
        )}

        {/* Data Loaded */}
        {!isLoading && data && data.members.length > 0 && (
          <>
            <TeamSummaryCards data={data} />
            <TeamPerformanceTable members={data.members} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
