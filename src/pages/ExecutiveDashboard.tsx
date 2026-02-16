import { AppLayout } from "@/components/layout/AppLayout";
import { NorthStarCards } from "@/components/executive/NorthStarCards";
import { PayoutTrendChart } from "@/components/executive/PayoutTrendChart";
import { AttainmentDistribution } from "@/components/executive/AttainmentDistribution";
import { PayoutByFunction } from "@/components/executive/PayoutByFunction";
import { TopPerformers } from "@/components/executive/TopPerformers";
import { useExecutiveDashboard } from "@/hooks/useExecutiveDashboard";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

export default function ExecutiveDashboard() {
  const { data, isLoading } = useExecutiveDashboard();
  const { selectedYear } = useFiscalYear();

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Executive Compensation Overview</h1>
          <p className="text-sm text-muted-foreground">FY {selectedYear} · Real-time aggregates · USD</p>
        </div>

        <NorthStarCards data={data} isLoading={isLoading} />

        <div className="grid gap-4 lg:grid-cols-2">
          <PayoutTrendChart data={data?.monthlyTrend || []} isLoading={isLoading} />
          <AttainmentDistribution data={data?.attainmentDistribution || []} isLoading={isLoading} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PayoutByFunction data={data?.payoutByFunction || []} isLoading={isLoading} />
          <PayoutByFunction title="Budget by Sales Function" data={data?.budgetByFunction || []} isLoading={isLoading} />
        </div>

        <TopPerformers data={data?.topPerformers || []} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
