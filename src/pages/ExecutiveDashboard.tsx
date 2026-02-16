import { AppLayout } from "@/components/layout/AppLayout";
import { NorthStarCards } from "@/components/executive/NorthStarCards";
import { PayoutTrendChart } from "@/components/executive/PayoutTrendChart";
import { AttainmentDistribution } from "@/components/executive/AttainmentDistribution";
import { PayoutByFunction } from "@/components/executive/PayoutByFunction";
import { TopPerformers } from "@/components/executive/TopPerformers";
import { useExecutiveDashboard } from "@/hooks/useExecutiveDashboard";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function ExecutiveDashboard() {
  const { data, isLoading } = useExecutiveDashboard();
  const { selectedYear } = useFiscalYear();
  const [currencyMode, setCurrencyMode] = useState<"usd" | "local">("usd");

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Executive Compensation Overview</h1>
            <p className="text-sm text-muted-foreground">FY {selectedYear} · Real-time aggregates</p>
          </div>
          <div className="flex items-center gap-2">
            {currencyMode === "local" && (
              <Badge variant="outline" className="border-warning text-warning text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Mixed currencies
              </Badge>
            )}
            <div className="flex rounded-md border border-input overflow-hidden">
              <Button
                variant={currencyMode === "usd" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8 px-3 text-xs"
                onClick={() => setCurrencyMode("usd")}
              >
                USD
              </Button>
              <Button
                variant={currencyMode === "local" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8 px-3 text-xs border-l"
                onClick={() => setCurrencyMode("local")}
              >
                Local
              </Button>
            </div>
          </div>
        </div>

        {/* Section 1: North Star Metrics */}
        <NorthStarCards data={data} isLoading={isLoading} currencyMode={currencyMode} />

        {/* Section 2: Trend Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <PayoutTrendChart data={data?.monthlyTrend || []} isLoading={isLoading} />
          <AttainmentDistribution data={data?.attainmentDistribution || []} isLoading={isLoading} />
        </div>

        {/* Section 3: Function Breakdown + Top Performers */}
        <div className="grid gap-4 lg:grid-cols-2">
          <PayoutByFunction data={data?.payoutByFunction || []} isLoading={isLoading} />
          <TopPerformers data={data?.topPerformers || []} isLoading={isLoading} />
        </div>
      </div>
    </AppLayout>
  );
}
