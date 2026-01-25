import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Settings, Users, Layers, ArrowRight, Edit, Trash2, Loader2, UserCog, Shield, Upload, Lock, Copy } from "lucide-react";
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
import { useCompPlans, useAvailableYears, CompPlan } from "@/hooks/useCompPlans";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useUserTargets } from "@/hooks/useUserTargets";
import { EmployeeAccounts } from "@/components/admin/EmployeeAccounts";
import { RoleManagement } from "@/components/admin/RoleManagement";
import { BulkUpload } from "@/components/admin/BulkUpload";
import { PermissionsManagement } from "@/components/admin/PermissionsManagement";
import { CompPlanFormDialog } from "@/components/admin/CompPlanFormDialog";
import { CompPlanDetailsDialog } from "@/components/admin/CompPlanDetailsDialog";
import { CopyPlansDialog } from "@/components/admin/CopyPlansDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Admin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { canAccessTab, canPerformAction } = usePermissions();
  
  // Use global fiscal year context
  const { selectedYear, yearOptions } = useFiscalYear();
  
  const { data: availableYears, isLoading: yearsLoading } = useAvailableYears();
  const { data: compPlans, isLoading: plansLoading } = useCompPlans(selectedYear);
  const { data: allTargets, isLoading: targetsLoading } = useUserTargets();

  // Dialog states
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CompPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<CompPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<CompPlan | null>(null);

  const isLoading = plansLoading || targetsLoading || yearsLoading;

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (values: { name: string; description?: string | null; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("comp_plans")
        .insert({
          name: values.name,
          description: values.description || null,
          is_active: values.is_active,
          effective_year: selectedYear,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plans"] });
      queryClient.invalidateQueries({ queryKey: ["comp_plan_years"] });
      setShowFormDialog(false);
      toast({ title: "Plan created", description: "Compensation plan has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (values: { id: string; name: string; description?: string | null; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("comp_plans")
        .update({
          name: values.name,
          description: values.description || null,
          is_active: values.is_active,
        })
        .eq("id", values.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plans"] });
      setEditingPlan(null);
      toast({ title: "Plan updated", description: "Compensation plan has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("comp_plans")
        .delete()
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plans"] });
      setDeletingPlan(null);
      toast({ title: "Plan deleted", description: "Compensation plan has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate assigned users per plan
  const getAssignedUsersCount = (planId: string) => {
    if (!allTargets) return 0;
    const uniqueUsers = new Set(allTargets.filter(t => t.plan_id === planId).map(t => t.user_id));
    return uniqueUsers.size;
  };

  // Get unique metrics count
  const getMetricsCount = () => {
    return compPlans?.length || 0;
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowFormDialog(true);
  };

  const handleEditPlan = (plan: CompPlan) => {
    setEditingPlan(plan);
    setShowFormDialog(true);
  };

  const handleViewPlan = (plan: CompPlan) => {
    navigate(`/admin/plan/${plan.id}`);
  };

  const handleDeletePlan = (plan: CompPlan) => {
    setDeletingPlan(plan);
  };

  const handleFormSubmit = (values: { name: string; description?: string | null; is_active: boolean }) => {
    if (editingPlan) {
      updatePlanMutation.mutate({ ...values, id: editingPlan.id });
    } else {
      createPlanMutation.mutate(values);
    }
  };

  const confirmDelete = () => {
    if (deletingPlan) {
      deletePlanMutation.mutate(deletingPlan.id);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Administration</h1>
            <p className="text-muted-foreground">Manage compensation plans and employee accounts</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList>
            {canAccessTab("tab:comp_plans") && (
              <TabsTrigger value="plans" className="gap-2">
                <Layers className="h-4 w-4" />
                Compensation Plans
              </TabsTrigger>
            )}
            {canAccessTab("tab:employee_accounts") && (
              <TabsTrigger value="accounts" className="gap-2">
                <UserCog className="h-4 w-4" />
                Employee Accounts
              </TabsTrigger>
            )}
            {canAccessTab("tab:bulk_upload") && (
              <TabsTrigger value="bulk-upload" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </TabsTrigger>
            )}
            {canAccessTab("tab:role_management") && (
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="h-4 w-4" />
                Role Management
              </TabsTrigger>
            )}
            {isAdmin() && (
              <TabsTrigger value="permissions" className="gap-2">
                <Lock className="h-4 w-4" />
                Permissions
              </TabsTrigger>
            )}
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
          {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2">
              {selectedYear > (yearOptions[0] || selectedYear - 1) && (
                <Button variant="outline" onClick={() => setShowCopyDialog(true)}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy from {selectedYear - 1}
                </Button>
              )}
              <Button variant="accent" onClick={handleCreatePlan}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create New Plan
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Layers className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Plans</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {isLoading ? "-" : compPlans?.filter(p => p.is_active).length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assignments</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {isLoading ? "-" : allTargets?.length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                      <Settings className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Plan Types</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {isLoading ? "-" : getMetricsCount()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plans Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compensation Plans</CardTitle>
                <CardDescription>Configure plan structures, metrics, and multiplier grids</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : compPlans && compPlans.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan Name</TableHead>
                        <TableHead className="text-center">Assigned Users</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compPlans.map((plan) => (
                        <TableRow key={plan.id} className="data-row">
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{plan.name}</p>
                              <p className="text-sm text-muted-foreground">{plan.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{getAssignedUsersCount(plan.id)}</span>
                          </TableCell>
                          <TableCell>
                            {plan.is_active ? (
                              <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditPlan(plan)}
                                title="Edit plan"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeletePlan(plan)}
                                title="Delete plan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPlan(plan)}
                                title="View details"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Layers className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No plans for {selectedYear}
                    </h3>
                    <p className="text-muted-foreground max-w-md mb-4">
                      Get started by creating a new plan or copy existing plans from a previous year.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowCopyDialog(true)}>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copy from {selectedYear - 1}
                      </Button>
                      <Button variant="accent" onClick={handleCreatePlan}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create New Plan
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan Builder Placeholder */}
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Plan Builder</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  Create custom compensation plans with multiple metrics, split weightings, 
                  gate thresholds, and accelerator multipliers.
                </p>
                <Button variant="accent" onClick={handleCreatePlan}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Start Building
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Accounts Tab */}
          {canAccessTab("tab:employee_accounts") && (
            <TabsContent value="accounts">
              <EmployeeAccounts />
            </TabsContent>
          )}

          {/* Bulk Upload Tab */}
          {canAccessTab("tab:bulk_upload") && (
            <TabsContent value="bulk-upload">
              <BulkUpload />
            </TabsContent>
          )}

          {/* Role Management Tab */}
          {canAccessTab("tab:role_management") && (
            <TabsContent value="roles">
              <RoleManagement />
            </TabsContent>
          )}

          {/* Permissions Tab - Admin Only */}
          {isAdmin() && (
            <TabsContent value="permissions">
              <PermissionsManagement />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Create/Edit Plan Dialog */}
      <CompPlanFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) setEditingPlan(null);
        }}
        plan={editingPlan}
        onSubmit={handleFormSubmit}
        isSubmitting={createPlanMutation.isPending || updatePlanMutation.isPending}
        selectedYear={selectedYear}
      />

      {/* View Plan Details Dialog */}
      <CompPlanDetailsDialog
        open={!!viewingPlan}
        onOpenChange={(open) => !open && setViewingPlan(null)}
        plan={viewingPlan}
      />

      {/* Copy Plans Dialog */}
      <CopyPlansDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        targetYear={selectedYear}
        availableYears={availableYears || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["comp_plans"] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Compensation Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPlan?.name}"? This action cannot be undone.
              {getAssignedUsersCount(deletingPlan?.id || "") > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This plan has {getAssignedUsersCount(deletingPlan?.id || "")} assigned user(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletePlanMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
