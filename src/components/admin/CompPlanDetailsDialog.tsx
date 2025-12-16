import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Users, Target, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CompPlanDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CompPlan | null;
}

export function CompPlanDetailsDialog({
  open,
  onOpenChange,
  plan,
}: CompPlanDetailsDialogProps) {
  // Fetch plan metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["plan_metrics", plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data, error } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", plan.id)
        .order("metric_name");
      if (error) throw error;
      return data;
    },
    enabled: !!plan?.id && open,
  });

  // Fetch assigned users with their profiles
  const { data: assignedUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["plan_assigned_users", plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data, error } = await supabase
        .from("user_targets")
        .select(`
          id,
          user_id,
          target_value_annual,
          target_bonus_percent,
          effective_start_date,
          effective_end_date,
          currency
        `)
        .eq("plan_id", plan.id);
      if (error) throw error;

      // Fetch employee details for these users
      if (data && data.length > 0) {
        const userIds = data.map((t) => t.user_id);
        const { data: employees, error: empError } = await supabase
          .from("employees")
          .select("id, full_name, employee_id, designation, sales_function")
          .in("id", userIds);
        
        if (empError) throw empError;

        // Merge data
        return data.map((target) => {
          const employee = employees?.find((e) => e.id === target.user_id);
          return {
            ...target,
            employee,
          };
        });
      }

      return [];
    },
    enabled: !!plan?.id && open,
  });

  const isLoading = metricsLoading || usersLoading;

  const formatLogicType = (logicType: string) => {
    return logicType.replace(/_/g, " ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{plan?.name}</DialogTitle>
            {plan?.is_active ? (
              <Badge className="bg-success/10 text-success">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <DialogDescription>
            {plan?.description || "No description provided."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Plan Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Plan Metrics ({metrics?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics && metrics.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric Name</TableHead>
                        <TableHead className="text-center">Weightage</TableHead>
                        <TableHead className="text-center">Logic Type</TableHead>
                        <TableHead className="text-center">Gate Threshold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.map((metric) => (
                        <TableRow key={metric.id}>
                          <TableCell className="font-medium">
                            {metric.metric_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {metric.weightage_percent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {formatLogicType(metric.logic_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {metric.gate_threshold_percent
                              ? `${metric.gate_threshold_percent}%`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No metrics configured for this plan.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Assigned Users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Assigned Users ({assignedUsers?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignedUsers && assignedUsers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead className="text-center">Sales Function</TableHead>
                        <TableHead className="text-right">Target Bonus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {user.employee?.full_name || "Unknown"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {user.employee?.employee_id || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.employee?.designation || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {user.employee?.sales_function ? (
                              <Badge variant="outline">
                                {user.employee.sales_function}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.target_bonus_percent
                              ? `${user.target_bonus_percent}%`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users assigned to this plan.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
