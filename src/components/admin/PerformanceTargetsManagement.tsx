import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Upload,
  Download,
  Search,
  Users,
  UserX,
  Edit,
  Trash2,
  Loader2,
  Target,
} from "lucide-react";
import { generateXLSX, downloadXLSX, type ColumnDef } from "@/lib/xlsxExport";
import {
  usePerformanceTargets,
  useDeletePerformanceTarget,
  useMetricTypes,
  PerformanceTargetRow,
} from "@/hooks/usePerformanceTargets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { PerformanceTargetFormDialog } from "./PerformanceTargetFormDialog";
import { PerformanceTargetsBulkUpload } from "./PerformanceTargetsBulkUpload";
import { toast } from "@/hooks/use-toast";

export function PerformanceTargetsManagement() {
  const { selectedYear } = useFiscalYear();
  const [searchTerm, setSearchTerm] = useState("");
  const [metricFilter, setMetricFilter] = useState<string>("all");
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PerformanceTargetRow | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<PerformanceTargetRow | null>(null);

  const { data: targets, isLoading } = usePerformanceTargets();
  const { data: metricTypes } = useMetricTypes();
  const deleteMutation = useDeletePerformanceTarget();

  // Fetch active non-staff employee records (those with a sales_function) for stats and exports
  const { data: activeEmployees } = useQuery({
    queryKey: ["active_sales_employees_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .eq("is_active", true)
        .not("sales_function", "is", null);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!targets) {
      return { employeesWithTargets: 0, employeesWithoutTargets: 0 };
    }

    const uniqueEmployees = new Set(targets.map((t) => t.employee_id));
    const withoutTargets = (activeEmployees?.length || 0) - uniqueEmployees.size;

    return {
      employeesWithTargets: uniqueEmployees.size,
      employeesWithoutTargets: Math.max(0, withoutTargets),
    };
  }, [targets, activeEmployees]);

  // Filter targets
  const filteredTargets = useMemo(() => {
    if (!targets) return [];

    return targets.filter((target) => {
      const matchesSearch =
        target.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.employee_id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMetric =
        metricFilter === "all" || target.metric_type === metricFilter;

      return matchesSearch && matchesMetric;
    });
  }, [targets, searchTerm, metricFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleEdit = (target: PerformanceTargetRow) => {
    setEditingTarget(target);
    setShowFormDialog(true);
  };

  const handleDelete = (target: PerformanceTargetRow) => {
    setDeletingTarget(target);
  };

  const confirmDelete = async () => {
    if (!deletingTarget) return;

    try {
      await deleteMutation.mutateAsync({
        employee_id: deletingTarget.employee_id,
        metric_type: deletingTarget.metric_type,
      });

      toast({
        title: "Target Deleted",
        description: "Performance target has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete target",
        variant: "destructive",
      });
    } finally {
      setDeletingTarget(null);
    }
  };

  const handleAddNew = () => {
    setEditingTarget(null);
    setShowFormDialog(true);
  };

  const handleExport = () => {
    if (!filteredTargets.length) return;
    const columns: ColumnDef<PerformanceTargetRow>[] = [
      { key: "full_name", header: "Employee Name" },
      { key: "employee_id", header: "Employee ID" },
      { key: "metric_type", header: "Metric Type" },
      { key: "q1", header: "Q1 (USD)" },
      { key: "q2", header: "Q2 (USD)" },
      { key: "q3", header: "Q3 (USD)" },
      { key: "q4", header: "Q4 (USD)" },
      { key: "annual", header: "Annual (USD)" },
    ];
    const blob = generateXLSX(filteredTargets, columns, "Performance Targets");
    downloadXLSX(blob, `performance_targets_${selectedYear}.xlsx`);
  };

  const handleExportWithTargets = () => {
    if (!targets?.length) return;
    const columns: ColumnDef<PerformanceTargetRow>[] = [
      { key: "full_name", header: "Employee Name" },
      { key: "employee_id", header: "Employee ID" },
      { key: "metric_type", header: "Metric Type" },
      { key: "q1", header: "Q1 (USD)" },
      { key: "q2", header: "Q2 (USD)" },
      { key: "q3", header: "Q3 (USD)" },
      { key: "q4", header: "Q4 (USD)" },
      { key: "annual", header: "Annual (USD)" },
    ];
    const blob = generateXLSX(targets, columns, "Employees With Targets");
    downloadXLSX(blob, `employees_with_targets_${selectedYear}.xlsx`);
  };

  const handleExportWithoutTargets = () => {
    if (!activeEmployees?.length || !targets) return;
    const employeesWithTargetIds = new Set(targets.map((t) => t.employee_id));
    const withoutTargets = activeEmployees.filter(
      (emp) => !employeesWithTargetIds.has(emp.employee_id)
    );
    if (!withoutTargets.length) {
      toast({ title: "All employees have targets assigned." });
      return;
    }
    const columns: ColumnDef<{ full_name: string; employee_id: string }>[] = [
      { key: "full_name", header: "Employee Name" },
      { key: "employee_id", header: "Employee ID" },
    ];
    const blob = generateXLSX(withoutTargets, columns, "Employees Without Targets");
    downloadXLSX(blob, `employees_without_targets_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={handleExportWithTargets}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Employees with Targets</p>
                <p className="text-2xl font-semibold text-foreground">
                  {isLoading ? "-" : stats.employeesWithTargets}
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={handleExportWithoutTargets}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning/10 text-warning">
                <UserX className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Without Targets</p>
                <p className="text-2xl font-semibold text-foreground">
                  {isLoading ? "-" : stats.employeesWithoutTargets}
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Performance Targets</CardTitle>
              <CardDescription>
                Manage quarterly and annual targets for {selectedYear}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExport} disabled={!filteredTargets.length}>
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Bulk Upload
              </Button>
              <Button variant="accent" onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Target
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <SearchableSelect
              value={metricFilter}
              onValueChange={setMetricFilter}
              options={[
                { value: "all", label: "All Metrics" },
                ...(metricTypes?.map((metric) => ({ value: metric, label: metric })) || []),
              ]}
              placeholder="Filter by metric"
              searchPlaceholder="Search metrics..."
              className="w-full sm:w-[220px]"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTargets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Metric Type</TableHead>
                    <TableHead className="text-right">Q1 (USD)</TableHead>
                    <TableHead className="text-right">Q2 (USD)</TableHead>
                    <TableHead className="text-right">Q3 (USD)</TableHead>
                    <TableHead className="text-right">Q4 (USD)</TableHead>
                    <TableHead className="text-right bg-muted/50">Annual (USD)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.map((target) => (
                    <TableRow key={`${target.employee_id}-${target.metric_type}`}>
                      <TableCell className="font-medium">{target.full_name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {target.employee_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{target.metric_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(target.q1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(target.q2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(target.q3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(target.q4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold bg-muted/50">
                        {formatCurrency(target.annual)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(target)}
                            title="Edit target"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(target)}
                            title="Delete target"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No performance targets for {selectedYear}
              </h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Add targets individually or use bulk upload to import from a CSV file.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Bulk Upload
                </Button>
                <Button variant="accent" onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Target
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <PerformanceTargetFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        editingTarget={editingTarget}
      />

      {/* Bulk Upload Dialog */}
      <PerformanceTargetsBulkUpload
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTarget} onOpenChange={() => setDeletingTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Performance Target?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the performance target for{" "}
              <strong>{deletingTarget?.full_name}</strong> ({deletingTarget?.metric_type}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
