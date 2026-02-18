import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Search, Users, DollarSign, Columns, Loader2, Receipt, BarChart3, Globe, Wallet, FileText, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { calculateProRation, getEffectiveDates } from "@/lib/compensation";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { PayoutStatement } from "@/components/reports/PayoutStatement";
import { ManagementSummary } from "@/components/reports/ManagementSummary";
import { CurrencyBreakdown } from "@/components/reports/CurrencyBreakdown";
import { YearEndHoldbackTracker } from "@/components/reports/YearEndHoldbackTracker";
import { AuditDashboard } from "@/components/audit/AuditDashboard";
import { PayoutWorkingsReport } from "@/components/reports/PayoutWorkingsReport";
import { useUserRole } from "@/hooks/useUserRole";
import { useSalesFunctions } from "@/hooks/useSalesFunctions";

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
  const { roles, canViewAllData } = useUserRole();
  const [activeTab, setActiveTab] = useState("employees");
  const [searchTerm, setSearchTerm] = useState("");
  const { salesFunctions: sfList } = useSalesFunctions();
  const [salesFunctionFilter, setSalesFunctionFilter] = useState("All");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_EMPLOYEE_COLUMNS.filter((c) => c.default).map((c) => c.key)
  );

  // Fetch employees with role-based filtering
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report", roles],
    queryFn: async () => {
      // Get current user for filtering
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Admins, GTM Ops, Finance, Executive see all
      if (canViewAllData()) {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .order("full_name");
        if (error) throw error;
        return data as Employee[];
      }

      // Get user's employee_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return [];

      // Sales Head: self + direct reports
      if (roles.includes("sales_head")) {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .or(`employee_id.eq.${profile.employee_id},manager_employee_id.eq.${profile.employee_id}`)
          .order("full_name");
        if (error) throw error;
        return data as Employee[];
      }

      // Sales Rep: self only
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("employee_id", profile.employee_id);
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch user targets with profiles - with role-based filtering
  const { data: userTargets = [] } = useQuery({
    queryKey: ["user-targets-report", selectedYear, roles],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Base query
      let query = supabase
        .from("user_targets")
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            sales_function,
            local_currency,
            date_of_hire,
            employee_id
          )
        `)
        .gte("effective_end_date", `${selectedYear}-01-01`)
        .lte("effective_start_date", `${selectedYear}-12-31`);

      const { data, error } = await query;
      if (error) throw error;

      // Admins, GTM Ops, Finance, Executive see all
      if (canViewAllData()) {
        return data as UserTarget[];
      }

      // Get user's employee_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return [];

      // Sales Head: filter to self + direct reports
      if (roles.includes("sales_head")) {
        const { data: teamMembers } = await supabase
          .from("employees")
          .select("employee_id")
          .or(`employee_id.eq.${profile.employee_id},manager_employee_id.eq.${profile.employee_id}`);
        
        const allowedIds = new Set((teamMembers || []).map(e => e.employee_id));
        return (data as any[]).filter(ut => 
          ut.profiles?.employee_id && allowedIds.has(ut.profiles.employee_id)
        ) as UserTarget[];
      }

      // Sales Rep: self only
      return (data as any[]).filter(ut => 
        ut.profiles?.employee_id === profile.employee_id
      ) as UserTarget[];
    },
  });


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


  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">View and export employee and compensation data</p>
        </div>

        <Tabs defaultValue="employees" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Personal Reports */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Reports</p>
            <TabsList className="bg-[hsl(var(--qota-navy))] text-white flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="employees" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                <Users className="mr-2 h-4 w-4" />
                Employee Master
              </TabsTrigger>
              <TabsTrigger value="compensation" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                <DollarSign className="mr-2 h-4 w-4" />
                Compensation
              </TabsTrigger>
              <TabsTrigger value="payout-statement" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                <Receipt className="mr-2 h-4 w-4" />
                Payout Statement
              </TabsTrigger>
              <TabsTrigger value="payout-workings" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                <ClipboardList className="mr-2 h-4 w-4" />
                Payout Workings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Management Reports */}
          {canViewAllData() && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Management Reports</p>
              <TabsList className="bg-[hsl(var(--qota-navy))] text-white flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="mgmt-summary" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Mgmt Summary
                </TabsTrigger>
                <TabsTrigger value="currency" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                  <Globe className="mr-2 h-4 w-4" />
                  Currency
                </TabsTrigger>
                <TabsTrigger value="holdbacks" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                  <Wallet className="mr-2 h-4 w-4" />
                  Holdbacks
                </TabsTrigger>
                <TabsTrigger value="audit-trail" className="data-[state=active]:bg-[hsl(var(--qota-teal))] data-[state=active]:text-white">
                  <FileText className="mr-2 h-4 w-4" />
                  Audit Trail
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          {/* Filters - Only show for Employee Master and Incentive Audit tabs */}
          {activeTab === "employees" && (
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
                <SearchableSelect
                  value={salesFunctionFilter}
                  onValueChange={setSalesFunctionFilter}
                  options={[{ value: "All", label: "All" }, ...sfList.map((sf) => ({ value: sf.name, label: sf.name }))]}
                  placeholder="Filter by Sales Function"
                  searchPlaceholder="Search functions..."
                  className="w-[200px]"
                />
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
                      <Button variant="outline">
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
                  <Button onClick={exportEmployees} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Download className="mr-2 h-4 w-4" />
                    Export All Fields
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {ALL_EMPLOYEE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((col) => (
                          <TableHead key={col.key} className="font-semibold whitespace-nowrap">
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
                <Button onClick={exportCompensation} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Sales Function</TableHead>
                      <TableHead className="font-semibold text-right">OTE (USD)</TableHead>
                      <TableHead className="font-semibold text-right">OTE (Local)</TableHead>
                      <TableHead className="font-semibold text-right">Target Bonus (USD)</TableHead>
                      <TableHead className="font-semibold text-right">Pro-Ration</TableHead>
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


          {/* Tab 6: Payout Statement */}
          <TabsContent value="payout-statement">
            <PayoutStatement />
          </TabsContent>

          {/* Tab 7: Payout Workings */}
          <TabsContent value="payout-workings">
            <PayoutWorkingsReport />
          </TabsContent>

          {/* Tab 7: Management Summary (Admin only) */}
          <TabsContent value="mgmt-summary">
            <ManagementSummary />
          </TabsContent>

          {/* Tab 8: Currency Breakdown (Admin only) */}
          <TabsContent value="currency">
            <CurrencyBreakdown />
          </TabsContent>

          {/* Tab 9: Year-End Holdback Tracker (Admin only) */}
          <TabsContent value="holdbacks">
            <YearEndHoldbackTracker />
          </TabsContent>

          {/* Tab 10: Comprehensive Audit Trail (Admin only) */}
          <TabsContent value="audit-trail">
            <AuditDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}