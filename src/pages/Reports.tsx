import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Search, Users, DollarSign, Calculator, Columns, Loader2, Percent, Briefcase, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { calculateProRation, getEffectiveDates } from "@/lib/compensation";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useIncentiveAuditData } from "@/hooks/useIncentiveAuditData";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { MyDealsReport } from "@/components/reports/MyDealsReport";
import { MyClosingARRReport } from "@/components/reports/MyClosingARRReport";
const SALES_FUNCTIONS = [
  "All",
  "Farmer",
  "Hunter",
  "CSM",
  "Sales Head - Hunter",
  "Sales head - Farmer",
  "Farmer - Retain",
  "Channel Sales",
  "Sales Engineering",
];

// All 27 employee fields for the master report
const ALL_EMPLOYEE_COLUMNS = [
  { key: "full_name", label: "Full Name", default: true },
  { key: "email", label: "Email", default: true },
  { key: "employee_id", label: "Employee ID", default: true },
  { key: "designation", label: "Designation", default: true },
  { key: "sales_function", label: "Sales Function", default: true },
  { key: "business_unit", label: "Business Unit", default: false },
  { key: "group_name", label: "Group Name", default: false },
  { key: "function_area", label: "Function Area", default: false },
  { key: "manager_employee_id", label: "Manager ID", default: false },
  { key: "manager_full_name", label: "Manager Name", default: false },
  { key: "date_of_hire", label: "Date of Joining", default: true },
  { key: "is_active", label: "Status", default: true },
  { key: "city", label: "City", default: false },
  { key: "country", label: "Country", default: false },
  { key: "local_currency", label: "Local Currency", default: false },
  { key: "department", label: "Department", default: false },
  { key: "region", label: "Region", default: false },
  { key: "departure_date", label: "Last Working Day", default: false },
  { key: "employee_role", label: "Employee Role", default: false },
  { key: "incentive_type", label: "Incentive Type", default: false },
  { key: "target_bonus_percent", label: "Target Bonus %", default: true },
  { key: "tfp_local_currency", label: "TFP (LC)", default: true },
  { key: "tvp_local_currency", label: "TVP (LC)", default: true },
  { key: "ote_local_currency", label: "OTE (LC)", default: true },
  { key: "tfp_usd", label: "TFP (USD)", default: false },
  { key: "tvp_usd", label: "TVP (USD)", default: false },
  { key: "ote_usd", label: "OTE (USD)", default: false },
];

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  designation: string | null;
  date_of_hire: string | null;
  departure_date: string | null;
  department: string | null;
  region: string | null;
  is_active: boolean;
  sales_function: string | null;
  local_currency: string;
  business_unit: string | null;
  group_name: string | null;
  function_area: string | null;
  manager_employee_id: string | null;
  city: string | null;
  country: string | null;
  employee_role: string | null;
  incentive_type: string | null;
  target_bonus_percent: number | null;
  tfp_local_currency: number | null;
  tvp_local_currency: number | null;
  ote_local_currency: number | null;
  tfp_usd: number | null;
  tvp_usd: number | null;
  ote_usd: number | null;
}

interface UserTarget {
  id: string;
  user_id: string;
  target_bonus_percent: number | null;
  tfp_local_currency: number | null;
  ote_local_currency: number | null;
  tfp_usd: number | null;
  target_bonus_usd: number | null;
  ote_usd: number | null;
  effective_start_date: string;
  effective_end_date: string;
  profiles?: {
    email: string;
    full_name: string;
    sales_function: string | null;
    local_currency: string;
    date_of_hire: string | null;
  };
}

export default function Reports() {
  const { selectedYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState("employees");
  const [searchTerm, setSearchTerm] = useState("");
  const [salesFunctionFilter, setSalesFunctionFilter] = useState("All");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_EMPLOYEE_COLUMNS.filter((c) => c.default).map((c) => c.key)
  );

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch user targets with profiles
  const { data: userTargets = [] } = useQuery({
    queryKey: ["user-targets-report", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_targets")
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            sales_function,
            local_currency,
            date_of_hire
          )
        `)
        .gte("effective_end_date", `${selectedYear}-01-01`)
        .lte("effective_start_date", `${selectedYear}-12-31`);
      if (error) throw error;
      return data as UserTarget[];
    },
  });

  // Use the database-driven incentive audit hook
  const { data: incentiveAuditData = [], isLoading: auditLoading } = useIncentiveAuditData(selectedYear);

  // Create manager lookup map
  const managerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp) => {
      map.set(emp.employee_id, emp.full_name);
    });
    return map;
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFunction =
        salesFunctionFilter === "All" || emp.sales_function === salesFunctionFilter;
      return matchesSearch && matchesFunction;
    });
  }, [employees, searchTerm, salesFunctionFilter]);

  // Compensation snapshot data
  const compensationData = useMemo(() => {
    return userTargets.map((target) => {
      const profile = target.profiles;
      if (!profile) return null;

      const { startDate, endDate } = getEffectiveDates(
        profile.date_of_hire,
        null,
        selectedYear
      );

      const proRation = calculateProRation({
        effectiveStartDate: startDate,
        effectiveEndDate: endDate,
        targetBonusUSD: target.target_bonus_usd || 0,
      });

      return {
        id: target.id,
        name: profile.full_name,
        email: profile.email,
        salesFunction: profile.sales_function,
        currency: profile.local_currency,
        oteUsd: target.ote_usd,
        oteLocal: target.ote_local_currency,
        targetBonusUsd: target.target_bonus_usd,
        targetBonusLocal: target.tfp_local_currency ? (target.ote_local_currency || 0) - target.tfp_local_currency : null,
        proRationFactor: proRation.proRationFactor,
      };
    }).filter(Boolean);
  }, [userTargets, selectedYear]);

  // Filter incentive audit data (now using the database-driven hook)
  const filteredAuditData = useMemo(() => {
    return incentiveAuditData.filter((item) => {
      const matchesSearch = item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFunction = salesFunctionFilter === "All" || item.salesFunction === salesFunctionFilter;
      return matchesSearch && matchesFunction;
    });
  }, [incentiveAuditData, searchTerm, salesFunctionFilter]);

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Get cell value for employee table
  const getCellValue = (emp: Employee, key: string): string => {
    switch (key) {
      case "full_name": return emp.full_name;
      case "email": return emp.email;
      case "employee_id": return emp.employee_id;
      case "designation": return emp.designation || "-";
      case "sales_function": return emp.sales_function || "-";
      case "business_unit": return emp.business_unit || "-";
      case "group_name": return emp.group_name || "-";
      case "function_area": return emp.function_area || "-";
      case "manager_employee_id": return emp.manager_employee_id || "-";
      case "manager_full_name": return emp.manager_employee_id ? (managerNameMap.get(emp.manager_employee_id) || emp.manager_employee_id) : "-";
      case "date_of_hire": return emp.date_of_hire ? format(new Date(emp.date_of_hire), "MMM dd, yyyy") : "-";
      case "is_active": return emp.is_active ? "Active" : "Inactive";
      case "city": return emp.city || "-";
      case "country": return emp.country || "-";
      case "local_currency": return emp.local_currency;
      case "department": return emp.department || "-";
      case "region": return emp.region || "-";
      case "departure_date": return emp.departure_date ? format(new Date(emp.departure_date), "MMM dd, yyyy") : "-";
      case "employee_role": return emp.employee_role || "-";
      case "incentive_type": return emp.incentive_type || "-";
      case "target_bonus_percent": return emp.target_bonus_percent != null ? `${emp.target_bonus_percent}%` : "-";
      case "tfp_local_currency": return emp.tfp_local_currency != null ? emp.tfp_local_currency.toLocaleString() : "-";
      case "tvp_local_currency": return emp.tvp_local_currency != null ? emp.tvp_local_currency.toLocaleString() : "-";
      case "ote_local_currency": return emp.ote_local_currency != null ? emp.ote_local_currency.toLocaleString() : "-";
      case "tfp_usd": return emp.tfp_usd != null ? `$${emp.tfp_usd.toLocaleString()}` : "-";
      case "tvp_usd": return emp.tvp_usd != null ? `$${emp.tvp_usd.toLocaleString()}` : "-";
      case "ote_usd": return emp.ote_usd != null ? `$${emp.ote_usd.toLocaleString()}` : "-";
      default: return "-";
    }
  };

  // CSV Export functions
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvRows = [headers.join(",")];
    data.forEach((row) => {
      const values = headers.map((h) => {
        const key = h.toLowerCase().replace(/ /g, "_");
        const value = row[key] ?? row[h] ?? "";
        return typeof value === "string" && value.includes(",") ? `"${value}"` : value;
      });
      csvRows.push(values.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportEmployees = () => {
    const data = filteredEmployees.map((e) => ({
      full_name: e.full_name,
      email: e.email,
      employee_id: e.employee_id,
      designation: e.designation || "",
      sales_function: e.sales_function || "",
      business_unit: e.business_unit || "",
      group_name: e.group_name || "",
      function_area: e.function_area || "",
      manager_employee_id: e.manager_employee_id || "",
      manager_full_name: e.manager_employee_id ? (managerNameMap.get(e.manager_employee_id) || "") : "",
      date_of_hire: e.date_of_hire || "",
      is_active: e.is_active ? "Active" : "Inactive",
      city: e.city || "",
      country: e.country || "",
      local_currency: e.local_currency,
      department: e.department || "",
      region: e.region || "",
      departure_date: e.departure_date || "",
      employee_role: e.employee_role || "",
      incentive_type: e.incentive_type || "",
      target_bonus_percent: e.target_bonus_percent ?? "",
      tfp_local_currency: e.tfp_local_currency ?? "",
      tvp_local_currency: e.tvp_local_currency ?? "",
      ote_local_currency: e.ote_local_currency ?? "",
      tfp_usd: e.tfp_usd ?? "",
      tvp_usd: e.tvp_usd ?? "",
      ote_usd: e.ote_usd ?? "",
    }));
    exportToCSV(data, "employee_master_full", ALL_EMPLOYEE_COLUMNS.map((c) => c.key));
  };

  const exportCompensation = () => {
    const data = compensationData.map((c: any) => ({
      name: c.name,
      sales_function: c.salesFunction || "",
      ote_usd: c.oteUsd || 0,
      ote_local: c.oteLocal || 0,
      target_bonus_usd: c.targetBonusUsd || 0,
      pro_ration_factor: (c.proRationFactor * 100).toFixed(1) + "%",
    }));
    exportToCSV(data, "compensation_snapshot", ["name", "sales_function", "ote_usd", "ote_local", "target_bonus_usd", "pro_ration_factor"]);
  };

  const exportIncentiveAudit = () => {
    const exportData: any[] = [];
    filteredAuditData.forEach((row) => {
      // Export variable pay metrics
      row.metrics.forEach((metric) => {
        exportData.push({
          employee_name: row.employeeName,
          plan_name: row.planName,
          sales_function: row.salesFunction || "",
          type: "Variable Pay",
          metric_name: metric.metricName,
          target: metric.target,
          actual: metric.actual,
          achievement_pct: metric.achievementPct.toFixed(1) + "%",
          logic_type: metric.logicType,
          multiplier: metric.multiplier.toFixed(2),
          allocation: metric.allocation.toFixed(2),
          payout: metric.payout.toFixed(2),
          holdback: "-",
        });
      });
      // Export commissions
      (row.commissions || []).forEach((comm) => {
        exportData.push({
          employee_name: row.employeeName,
          plan_name: row.planName,
          sales_function: row.salesFunction || "",
          type: "Commission",
          metric_name: comm.commissionType,
          target: "-",
          actual: comm.dealValue.toFixed(2),
          achievement_pct: "-",
          logic_type: "-",
          multiplier: (comm.rate / 100).toFixed(4),
          allocation: "-",
          payout: comm.immediatePayout.toFixed(2),
          holdback: comm.holdback.toFixed(2),
        });
      });
    });
    exportToCSV(exportData, "incentive_audit", [
      "employee_name", "plan_name", "sales_function", "type", "metric_name", "target", 
      "actual", "achievement_pct", "logic_type", "multiplier", "allocation", "payout", "holdback"
    ]);
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">View and export employee and compensation data</p>
        </div>

        <Tabs defaultValue="employees" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-[hsl(var(--azentio-navy))] text-white flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="employees" className="data-[state=active]:bg-[hsl(var(--azentio-teal))] data-[state=active]:text-white">
              <Users className="mr-2 h-4 w-4" />
              Employee Master
            </TabsTrigger>
            <TabsTrigger value="compensation" className="data-[state=active]:bg-[hsl(var(--azentio-teal))] data-[state=active]:text-white">
              <DollarSign className="mr-2 h-4 w-4" />
              Compensation Snapshot
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-[hsl(var(--azentio-teal))] data-[state=active]:text-white">
              <Calculator className="mr-2 h-4 w-4" />
              Incentive Audit
            </TabsTrigger>
            <TabsTrigger value="my-deals" className="data-[state=active]:bg-[hsl(var(--azentio-teal))] data-[state=active]:text-white">
              <Briefcase className="mr-2 h-4 w-4" />
              My Deals
            </TabsTrigger>
            <TabsTrigger value="my-closing-arr" className="data-[state=active]:bg-[hsl(var(--azentio-teal))] data-[state=active]:text-white">
              <Database className="mr-2 h-4 w-4" />
              My Closing ARR
            </TabsTrigger>
          </TabsList>

          {/* Filters - Only show for Employee Master and Incentive Audit tabs */}
          {(activeTab === "employees" || activeTab === "audit") && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={salesFunctionFilter} onValueChange={setSalesFunctionFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by Sales Function" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_FUNCTIONS.map((sf) => (
                      <SelectItem key={sf} value={sf}>{sf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Tab 1: Employee Master Data */}
          <TabsContent value="employees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Employee Master Data</CardTitle>
                  <CardDescription>Complete employee directory with column toggle</CardDescription>
                </div>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border-[hsl(var(--azentio-navy))]">
                        <Columns className="mr-2 h-4 w-4" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                      {ALL_EMPLOYEE_COLUMNS.map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={visibleColumns.includes(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        >
                          {col.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={exportEmployees} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
                    <Download className="mr-2 h-4 w-4" />
                    Export All Fields
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[hsl(var(--azentio-navy))]">
                        {ALL_EMPLOYEE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((col) => (
                          <TableHead key={col.key} className="text-white font-semibold whitespace-nowrap">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.id} className="data-row">
                          {ALL_EMPLOYEE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((col) => (
                            <TableCell key={col.key} className={col.key === "full_name" ? "font-medium" : ""}>
                              {col.key === "is_active" ? (
                                <span className={`status-badge ${emp.is_active ? "status-on-track" : "status-behind"}`}>
                                  {emp.is_active ? "Active" : "Inactive"}
                                </span>
                              ) : (
                                getCellValue(emp, col.key)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                {filteredEmployees.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No employees found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Compensation Snapshot */}
          <TabsContent value="compensation">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Compensation Snapshot</CardTitle>
                  <CardDescription>OTE, Target Bonus, and Pro-ration factors for FY{selectedYear}</CardDescription>
                </div>
                <Button onClick={exportCompensation} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(var(--azentio-navy))]">
                      <TableHead className="text-white font-semibold">Name</TableHead>
                      <TableHead className="text-white font-semibold">Sales Function</TableHead>
                      <TableHead className="text-white font-semibold text-right">OTE (USD)</TableHead>
                      <TableHead className="text-white font-semibold text-right">OTE (Local)</TableHead>
                      <TableHead className="text-white font-semibold text-right">Target Bonus (USD)</TableHead>
                      <TableHead className="text-white font-semibold text-right">Pro-Ration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compensationData.map((comp: any) => (
                      <TableRow key={comp.id} className="data-row">
                        <TableCell className="font-medium">{comp.name}</TableCell>
                        <TableCell>{comp.salesFunction || "-"}</TableCell>
                        <TableCell className="text-right">${(comp.oteUsd || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(comp.oteLocal || 0).toLocaleString()} {comp.currency}</TableCell>
                        <TableCell className="text-right">${(comp.targetBonusUsd || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${comp.proRationFactor < 1 ? "text-warning" : "text-success"}`}>
                            {(comp.proRationFactor * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {compensationData.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No compensation data found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Incentive Audit - Now Database-Driven with Commission */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Incentive Audit</CardTitle>
                  <CardDescription>
                    Variable Pay: (Actual / Target) × Multiplier × Allocation = Payout | Commission: Deal Value × Rate (75% Paid / 25% Holdback)
                  </CardDescription>
                </div>
                <Button onClick={exportIncentiveAudit} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {auditLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Variable Pay Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-[hsl(var(--azentio-teal))]" />
                        Variable Pay
                      </h3>
                      <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[hsl(var(--azentio-navy))]">
                              <TableHead className="text-white font-semibold">Name</TableHead>
                              <TableHead className="text-white font-semibold">Plan</TableHead>
                              <TableHead className="text-white font-semibold">Metric</TableHead>
                              <TableHead className="text-white font-semibold text-right">Target</TableHead>
                              <TableHead className="text-white font-semibold text-right">Actual</TableHead>
                              <TableHead className="text-white font-semibold text-right">Achievement</TableHead>
                              <TableHead className="text-white font-semibold text-right">Multiplier</TableHead>
                              <TableHead className="text-white font-semibold text-right">Allocation</TableHead>
                              <TableHead className="text-white font-semibold text-right">Payout</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAuditData.flatMap((row) => 
                              row.metrics.map((metric, idx) => (
                                <TableRow key={`${row.employeeId}-${metric.metricName}`} className="data-row">
                                  {idx === 0 ? (
                                    <TableCell className="font-medium" rowSpan={row.metrics.length}>
                                      {row.employeeName}
                                    </TableCell>
                                  ) : null}
                                  {idx === 0 ? (
                                    <TableCell rowSpan={row.metrics.length}>{row.planName}</TableCell>
                                  ) : null}
                                  <TableCell>
                                    {metric.metricName}
                                    {metric.isGated && (
                                      <span className="ml-1 text-xs text-warning">(Gate: {metric.gateThreshold}%)</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">${metric.target.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">${metric.actual.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <span className={
                                      metric.achievementPct >= 100 ? "text-success" : 
                                      metric.achievementPct >= 85 ? "text-warning" : "text-destructive"
                                    }>
                                      {metric.achievementPct.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">{metric.multiplier.toFixed(2)}x</TableCell>
                                  <TableCell className="text-right">${metric.allocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                  <TableCell className="text-right font-semibold text-[hsl(var(--azentio-teal))]">
                                    ${metric.payout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            {/* Total row per employee */}
                            {filteredAuditData.map((row) => (
                              <TableRow key={`${row.employeeId}-vp-total`} className="bg-muted/50 font-semibold">
                                <TableCell colSpan={8} className="text-right">
                                  Variable Pay Total for {row.employeeName}:
                                </TableCell>
                                <TableCell className="text-right text-[hsl(var(--azentio-teal))]">
                                  ${row.totalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>

                    {/* Commission Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Percent className="h-5 w-5 text-[hsl(var(--azentio-teal))]" />
                        Commission Payouts
                      </h3>
                      <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[hsl(var(--azentio-navy))]">
                              <TableHead className="text-white font-semibold">Name</TableHead>
                              <TableHead className="text-white font-semibold">Plan</TableHead>
                              <TableHead className="text-white font-semibold">Commission Type</TableHead>
                              <TableHead className="text-white font-semibold text-right">Deal Value</TableHead>
                              <TableHead className="text-white font-semibold text-right">Rate</TableHead>
                              <TableHead className="text-white font-semibold text-right">Gross</TableHead>
                              <TableHead className="text-white font-semibold text-right">Paid (75%)</TableHead>
                              <TableHead className="text-white font-semibold text-right">Holdback (25%)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAuditData.filter(row => (row.commissions || []).length > 0).flatMap((row) => 
                              (row.commissions || []).map((comm, idx) => (
                                <TableRow key={`${row.employeeId}-comm-${comm.commissionType}`} className="data-row">
                                  {idx === 0 ? (
                                    <TableCell className="font-medium" rowSpan={row.commissions.length}>
                                      {row.employeeName}
                                    </TableCell>
                                  ) : null}
                                  {idx === 0 ? (
                                    <TableCell rowSpan={row.commissions.length}>{row.planName}</TableCell>
                                  ) : null}
                                  <TableCell>{comm.commissionType}</TableCell>
                                  <TableCell className="text-right">${comm.dealValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                  <TableCell className="text-right">{comm.rate}%</TableCell>
                                  <TableCell className="text-right">${comm.grossCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                  <TableCell className="text-right font-semibold text-[hsl(var(--azentio-teal))]">
                                    ${comm.immediatePayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </TableCell>
                                  <TableCell className="text-right text-warning">
                                    ${comm.holdback.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            {/* Commission totals per employee */}
                            {filteredAuditData.filter(row => (row.commissions || []).length > 0).map((row) => (
                              <TableRow key={`${row.employeeId}-comm-total`} className="bg-muted/50 font-semibold">
                                <TableCell colSpan={5} className="text-right">
                                  Commission Total for {row.employeeName}:
                                </TableCell>
                                <TableCell className="text-right">
                                  ${(row.totalCommissionGross || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right text-[hsl(var(--azentio-teal))]">
                                  ${(row.totalCommissionPaid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right text-warning">
                                  ${(row.totalCommissionHoldback || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                      {filteredAuditData.filter(row => (row.commissions || []).length > 0).length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No commission data found</p>
                      )}
                    </div>

                    {/* Grand Total Section */}
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-3">Grand Total by Employee</h3>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[hsl(var(--azentio-navy))]">
                            <TableHead className="text-white font-semibold">Name</TableHead>
                            <TableHead className="text-white font-semibold text-right">Variable Pay</TableHead>
                            <TableHead className="text-white font-semibold text-right">Commission (Paid)</TableHead>
                            <TableHead className="text-white font-semibold text-right">Commission (Holdback)</TableHead>
                            <TableHead className="text-white font-semibold text-right">Total Payout</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAuditData.map((row) => (
                            <TableRow key={`${row.employeeId}-grand`} className="data-row">
                              <TableCell className="font-medium">{row.employeeName}</TableCell>
                              <TableCell className="text-right">
                                ${row.totalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right">
                                ${(row.totalCommissionPaid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right text-warning">
                                ${(row.totalCommissionHoldback || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right font-bold text-[hsl(var(--azentio-teal))]">
                                ${(row.totalPayout + (row.totalCommissionPaid || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                {!auditLoading && filteredAuditData.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No incentive data found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: My Deals */}
          <TabsContent value="my-deals">
            <MyDealsReport />
          </TabsContent>

          {/* Tab 5: My Closing ARR */}
          <TabsContent value="my-closing-arr">
            <MyClosingARRReport />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}