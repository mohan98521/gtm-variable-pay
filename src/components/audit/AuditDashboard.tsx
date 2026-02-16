import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, FileText, Activity, AlertTriangle, Clock, BarChart3 } from "lucide-react";
import { useUnifiedAuditLog, useAuditSummary, type UnifiedAuditFilters } from "@/hooks/useUnifiedAuditLog";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { AuditFilters } from "./AuditFilters";
import { AuditTimeline } from "./AuditTimeline";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";

export function AuditDashboard() {
  const { selectedYear } = useFiscalYear();
  const [filters, setFilters] = useState<UnifiedAuditFilters>({
    startDate: `${selectedYear}-01-01`,
    endDate: `${selectedYear}-12-31`,
  });

  const { data: entries, isLoading } = useUnifiedAuditLog(filters);
  const summary = useAuditSummary(entries);

  // Employee lookup
  const { data: employeeMap } = useQuery({
    queryKey: ["employees_lookup_audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("employee_id, full_name");
      return new Map(data?.map((e) => [e.employee_id, e.full_name]) || []);
    },
  });

  // User (profile) lookup for changed_by UUIDs
  const { data: userMap } = useQuery({
    queryKey: ["profiles_lookup_audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name");
      return new Map(data?.map((p) => [p.id, p.full_name]) || []);
    },
  });

  const handleExport = () => {
    if (!entries?.length) return;
    exportToXLSX(
      entries.map((e) => ({
        timestamp: format(new Date(e.changed_at), "yyyy-MM-dd HH:mm:ss"),
        domain: e.domain,
        table: e.table_name,
        action: e.action,
        changed_by: e.changed_by ? (userMap?.get(e.changed_by) || e.changed_by) : "System",
        employee: e.employee_id ? (employeeMap?.get(e.employee_id) || e.employee_id) : "",
        amount_usd: e.amount_usd || "",
        is_retroactive: e.is_retroactive ? "Yes" : "",
        is_rate_mismatch: e.is_rate_mismatch ? "Yes" : "",
        comp_rate: e.compensation_rate || "",
        market_rate: e.market_rate || "",
        variance_pct: e.rate_variance_pct || "",
        reason: e.reason || "",
        month_year: e.month_year || "",
      })),
      `audit_trail_${selectedYear}`
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Comprehensive Audit Trail — FY{selectedYear}
          </h2>
          <p className="text-muted-foreground">
            Unified view across all system changes: Deals, Payouts, Config, Master Data
          </p>
        </div>
        <Button onClick={handleExport} className="bg-[hsl(var(--qota-teal))] hover:bg-[hsl(var(--qota-teal))]/90">
          <Download className="mr-2 h-4 w-4" />
          Export XLSX
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={Activity} label="Total Events" value={summary.totalEntries} />
        <SummaryCard icon={Clock} label="Today" value={summary.todayCount} />
        <SummaryCard icon={BarChart3} label="This Week" value={summary.weekCount} />
        <SummaryCard
          icon={AlertTriangle}
          label="Rate Mismatches"
          value={summary.rateMismatches}
          variant={summary.rateMismatches > 0 ? "destructive" : "default"}
        />
        <SummaryCard
          icon={Clock}
          label="Retroactive"
          value={summary.retroactiveChanges}
          variant={summary.retroactiveChanges > 0 ? "warning" : "default"}
        />
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">By Domain</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(summary.domainBreakdown).slice(0, 4).map(([d, c]) => (
              <Badge key={d} variant="outline" className="text-xs">
                {d}: {c}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <AuditFilters filters={filters} onFiltersChange={setFilters} />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Timeline</CardTitle>
          <CardDescription>
            {entries?.length || 0} entries — click any row to expand details & diff
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditTimeline
            entries={entries || []}
            employeeMap={employeeMap || new Map()}
            userMap={userMap || new Map()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant?: "default" | "destructive" | "warning";
}) {
  const colorClass =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
      ? "text-warning"
      : "text-foreground";

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </Card>
  );
}
