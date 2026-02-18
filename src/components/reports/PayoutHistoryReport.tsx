import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Download, Loader2 } from "lucide-react";
import { generateXLSX, downloadXLSX, type ColumnDef } from "@/lib/xlsxExport";

interface PayoutRow {
  id: string;
  employee_id: string;
  month_year: string;
  payout_type: string;
  calculated_amount_usd: number;
  calculated_amount_local: number | null;
  booking_amount_usd: number | null;
  booking_amount_local: number | null;
  collection_amount_usd: number | null;
  collection_amount_local: number | null;
  year_end_amount_usd: number | null;
  year_end_amount_local: number | null;
  clawback_amount_usd: number | null;
  clawback_amount_local: number | null;
  local_currency: string | null;
  exchange_rate_used: number | null;
  payout_run_id: string | null;
  // joined client-side
  employee_name?: string;
  emp_id_text?: string;
  manager_employee_id?: string;
}

export function PayoutHistoryReport() {
  const { selectedYear } = useFiscalYear();
  const { roles, canViewAllData } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState("all");

  // Fetch payout runs for the fiscal year (finalized/paid only)
  const { data: payoutRuns = [] } = useQuery({
    queryKey: ["payout-history-runs", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_runs")
        .select("id, month_year, run_status")
        .gte("month_year", `${selectedYear}-01-01`)
        .lte("month_year", `${selectedYear}-12-31`)
        .in("run_status", ["finalized", "paid"])
        .order("month_year", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch employees lookup
  const { data: employeesMap = new Map() } = useQuery({
    queryKey: ["employees-lookup-payout-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_id, manager_employee_id");
      if (error) throw error;
      const map = new Map<string, { full_name: string; employee_id: string; manager_employee_id: string | null }>();
      (data || []).forEach((e) => map.set(e.id, e));
      return map;
    },
  });

  // Fetch monthly_payouts for finalized/paid runs
  const { data: rawPayouts = [], isLoading } = useQuery({
    queryKey: ["payout-history-data", selectedYear, payoutRuns.length],
    queryFn: async () => {
      const runIds = payoutRuns.map((r) => r.id);
      if (runIds.length === 0) return [];

      const { data, error } = await supabase
        .from("monthly_payouts")
        .select(`
          id, employee_id, month_year, payout_type,
          calculated_amount_usd, calculated_amount_local,
          booking_amount_usd, booking_amount_local,
          collection_amount_usd, collection_amount_local,
          year_end_amount_usd, year_end_amount_local,
          clawback_amount_usd, clawback_amount_local,
          local_currency, exchange_rate_used, payout_run_id
        `)
        .in("payout_run_id", runIds)
        .order("month_year", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: payoutRuns.length > 0,
  });

  // Get current user's employee_id for role-based filtering
  const { data: currentProfile } = useQuery({
    queryKey: ["current-profile-payout-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // Enrich + filter
  const filteredPayouts = useMemo(() => {
    let data: PayoutRow[] = rawPayouts.map((p) => {
      const emp = employeesMap.get(p.employee_id);
      return {
        ...p,
        employee_name: emp?.full_name || "-",
        emp_id_text: emp?.employee_id || "-",
        manager_employee_id: emp?.manager_employee_id || null,
      } as PayoutRow;
    });

    // Role-based filtering
    if (!canViewAllData()) {
      const myEmpId = currentProfile?.employee_id;
      if (!myEmpId) return [];

      if (roles.includes("sales_head")) {
        data = data.filter(
          (p) => p.emp_id_text === myEmpId || p.manager_employee_id === myEmpId
        );
      } else {
        data = data.filter((p) => p.emp_id_text === myEmpId);
      }
    }

    // Month filter
    if (selectedMonth !== "all") {
      data = data.filter((p) => p.month_year === selectedMonth);
    }

    return data;
  }, [rawPayouts, employeesMap, selectedMonth, canViewAllData, roles, currentProfile]);

  const fmtNum = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-";

  const fmtUsd = (v: number | null | undefined) =>
    v != null ? `$${fmtNum(v)}` : "-";

  const monthOptions = useMemo(() => {
    return payoutRuns.map((r) => ({
      value: r.month_year,
      label: format(new Date(r.month_year), "MMMM yyyy"),
    }));
  }, [payoutRuns]);

  const handleExport = () => {
    if (filteredPayouts.length === 0) return;

    const columns: ColumnDef<PayoutRow>[] = [
      { key: "employee_name", header: "Employee Name" },
      { key: "emp_id_text", header: "Employee ID" },
      { key: "month", header: "Month", getValue: (r) => format(new Date(r.month_year), "MMM yyyy") },
      { key: "payout_type", header: "Payout Type" },
      { key: "calculated_amount_usd", header: "Eligible (USD)" },
      { key: "calculated_amount_local", header: "Eligible (Local)" },
      { key: "booking_amount_usd", header: "Upon Booking (USD)" },
      { key: "booking_amount_local", header: "Upon Booking (Local)" },
      { key: "collection_amount_usd", header: "Upon Collection (USD)" },
      { key: "collection_amount_local", header: "Upon Collection (Local)" },
      { key: "year_end_amount_usd", header: "Year-End (USD)" },
      { key: "year_end_amount_local", header: "Year-End (Local)" },
      { key: "clawback_amount_usd", header: "Clawback (USD)" },
      { key: "clawback_amount_local", header: "Clawback (Local)" },
      { key: "local_currency", header: "Currency" },
      { key: "exchange_rate_used", header: "Exchange Rate" },
    ];

    const blob = generateXLSX(filteredPayouts, columns, "Payout History");
    downloadXLSX(blob, `payout_history_${selectedYear}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Payout History</CardTitle>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredPayouts.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPayouts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No payout history found for {selectedYear}.
          </p>
        ) : (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Employee Name</TableHead>
                  <TableHead className="whitespace-nowrap">Employee ID</TableHead>
                  <TableHead className="whitespace-nowrap">Month</TableHead>
                  <TableHead className="whitespace-nowrap">Payout Type</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Eligible (USD)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Eligible (Local)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Booking (USD)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Booking (Local)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Collection (USD)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Collection (Local)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Year-End (USD)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Year-End (Local)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Clawback (USD)</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Clawback (Local)</TableHead>
                  <TableHead className="whitespace-nowrap">Currency</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Exchange Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{p.employee_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.emp_id_text}</TableCell>
                    <TableCell className="whitespace-nowrap">{format(new Date(p.month_year), "MMM yyyy")}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.payout_type}</TableCell>
                    <TableCell className="text-right">{fmtUsd(p.calculated_amount_usd)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.calculated_amount_local)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(p.booking_amount_usd)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.booking_amount_local)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(p.collection_amount_usd)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.collection_amount_local)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(p.year_end_amount_usd)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.year_end_amount_local)}</TableCell>
                    <TableCell className="text-right">{fmtUsd(p.clawback_amount_usd)}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.clawback_amount_local)}</TableCell>
                    <TableCell>{p.local_currency || "-"}</TableCell>
                    <TableCell className="text-right">{p.exchange_rate_used ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
