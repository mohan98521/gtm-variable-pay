import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Users, Layers, ArrowRight, Edit, Trash2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompPlans } from "@/hooks/useCompPlans";
import { useUserTargets } from "@/hooks/useUserTargets";

export default function Admin() {
  const { data: compPlans, isLoading: plansLoading } = useCompPlans();
  const { data: allTargets, isLoading: targetsLoading } = useUserTargets();

  const isLoading = plansLoading || targetsLoading;

  // Calculate assigned users per plan
  const getAssignedUsersCount = (planId: string) => {
    if (!allTargets) return 0;
    const uniqueUsers = new Set(allTargets.filter(t => t.plan_id === planId).map(t => t.user_id));
    return uniqueUsers.size;
  };

  // Get unique metrics count (placeholder for now)
  const getMetricsCount = () => {
    // This would come from plan_metrics table
    return compPlans?.length || 0;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Plan Configuration</h1>
            <p className="text-muted-foreground">Create and manage compensation plans</p>
          </div>
          <Button variant="accent">
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
            ) : (
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
                  {compPlans?.map((plan) => (
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
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <Button variant="accent">
              <Plus className="h-4 w-4 mr-1.5" />
              Start Building
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
