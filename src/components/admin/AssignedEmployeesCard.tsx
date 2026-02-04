import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Users, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { usePlanAssignedEmployees, useDeletePlanAssignment } from "@/hooks/usePlanAssignments";
import { PlanAssignmentDialog } from "./PlanAssignmentDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssignedEmployeesCardProps {
  planId: string;
  planName: string;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  local_currency: string;
  tfp_local_currency?: number | null;
  tfp_usd?: number | null;
  target_bonus_percent?: number | null;
  ote_local_currency?: number | null;
  ote_usd?: number | null;
  auth_user_id?: string | null;
}

export function AssignedEmployeesCard({ planId, planName }: AssignedEmployeesCardProps) {
  const { data: assignedEmployees = [], isLoading } = usePlanAssignedEmployees(planId);
  const deleteMutation = useDeletePlanAssignment();
  
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<any>(null);

  // Fetch all employees for the assign dialog
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      
      if (error) throw error;
      return data as Employee[];
    },
  });

  const handleAssign = () => {
    setSelectedEmployee(null);
    setEditingAssignment(null);
    setShowAssignDialog(true);
  };

  const handleEdit = (assignment: any) => {
    // Find the employee for this assignment
    const employee = allEmployees.find(e => e.id === assignment.user_id);
    if (employee) {
      setSelectedEmployee(employee);
      setEditingAssignment(assignment);
      setShowAssignDialog(true);
    }
  };

  const handleDelete = async () => {
    if (!deletingAssignment) return;
    
    await deleteMutation.mutateAsync({
      id: deletingAssignment.id,
      userId: deletingAssignment.user_id,
      planId: planId,
    });
    
    setDeletingAssignment(null);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Assigned Employees</CardTitle>
              <CardDescription>
                Employees assigned to this compensation plan
              </CardDescription>
            </div>
            <Button variant="accent" onClick={handleAssign}>
              <Plus className="h-4 w-4 mr-1.5" />
              Assign Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignedEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Employees Assigned</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                No employees have been assigned to this plan yet. Click the button above to assign employees.
              </p>
              <Button variant="accent" onClick={handleAssign}>
                <Plus className="h-4 w-4 mr-1.5" />
                Assign First Employee
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead className="text-right">OTE (USD)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedEmployees.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-mono text-sm">
                        {assignment.employee_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {assignment.employee_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(assignment.effective_start_date), "MMM d, yyyy")} -{" "}
                        {format(new Date(assignment.effective_end_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(assignment.ote_usd)}
                      </TableCell>
                      <TableCell>
                        {assignment.employee_is_active ? (
                          <Badge className="bg-success/10 text-success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(assignment)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Assignment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingAssignment(assignment)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove Assignment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign/Edit Dialog - Only open after employee is selected or editing */}
      <PlanAssignmentDialog
        open={showAssignDialog && (selectedEmployee !== null || editingAssignment !== null)}
        onOpenChange={(open) => {
          setShowAssignDialog(open);
          if (!open) {
            setSelectedEmployee(null);
            setEditingAssignment(null);
          }
        }}
        employee={selectedEmployee}
        existingAssignment={editingAssignment}
        preselectedPlanId={planId}
      />

      {/* Employee Selection Dialog for new assignments */}
      {showAssignDialog && !selectedEmployee && !editingAssignment && (
        <SelectEmployeeForAssignment
          open={true}
          onOpenChange={(open) => {
            if (!open) setShowAssignDialog(false);
          }}
          employees={allEmployees}
          assignedEmployeeIds={assignedEmployees.map((a) => a.user_id)}
          onSelect={(employee) => {
            setSelectedEmployee(employee);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingAssignment}
        onOpenChange={(open) => !open && setDeletingAssignment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deletingAssignment?.employee_name}</strong> from
              this plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Sub-component for selecting an employee
function SelectEmployeeForAssignment({
  open,
  onOpenChange,
  employees,
  assignedEmployeeIds,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  assignedEmployeeIds: string[];
  onSelect: (employee: Employee) => void;
}) {
  const availableEmployees = employees.filter(
    (e) => !assignedEmployeeIds.includes(e.id)
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Select Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Choose an employee to assign to this plan
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {availableEmployees.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              All active employees are already assigned to this plan.
            </p>
          ) : (
            <div className="space-y-2">
              {availableEmployees.map((employee) => (
                <button
                  key={employee.id}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                  onClick={() => onSelect(employee)}
                >
                  <div className="font-medium">{employee.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {employee.employee_id} • {employee.email}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
