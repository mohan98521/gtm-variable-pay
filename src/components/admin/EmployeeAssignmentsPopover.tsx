import { useState } from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Target, Plus, Pencil, Trash2, Loader2, ChevronRight } from "lucide-react";
import { useEmployeePlanAssignments, useDeletePlanAssignment } from "@/hooks/usePlanAssignments";
import { PlanAssignmentDialog } from "./PlanAssignmentDialog";
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

interface EmployeeAssignmentsPopoverProps {
  employee: Employee;
  assignmentCount: number;
}

export function EmployeeAssignmentsPopover({ 
  employee, 
  assignmentCount 
}: EmployeeAssignmentsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<any>(null);

  const { data: assignments = [], isLoading } = useEmployeePlanAssignments(
    open ? employee.id : undefined
  );
  const deleteMutation = useDeletePlanAssignment();

  const handleAddAssignment = () => {
    setEditingAssignment(null);
    setShowAssignDialog(true);
    setOpen(false);
  };

  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment({
      id: assignment.id,
      plan_id: assignment.plan_id,
      effective_start_date: assignment.effective_start_date,
      effective_end_date: assignment.effective_end_date,
      currency: assignment.currency,
      tfp_local_currency: assignment.tfp_local_currency,
      target_bonus_percent: assignment.target_bonus_percent,
      ote_local_currency: assignment.ote_local_currency,
      tfp_usd: assignment.tfp_usd,
      target_bonus_usd: assignment.target_bonus_usd,
      ote_usd: assignment.ote_usd,
      target_value_annual: assignment.target_value_annual,
    });
    setShowAssignDialog(true);
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingAssignment) return;
    
    await deleteMutation.mutateAsync({
      id: deletingAssignment.id,
      userId: employee.id,
      planId: deletingAssignment.plan_id,
    });
    
    setDeletingAssignment(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-auto py-1 px-2 gap-1"
          >
            <Target className="h-3.5 w-3.5" />
            <span>{assignmentCount}</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Plan Assignments</h4>
                <p className="text-xs text-muted-foreground">{employee.full_name}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleAddAssignment}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">No plan assignments yet</p>
              <Button size="sm" variant="outline" onClick={handleAddAssignment}>
                <Plus className="h-4 w-4 mr-1" />
                Assign to Plan
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="p-2 space-y-1">
                {assignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="p-2 rounded-md hover:bg-muted group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {assignment.comp_plans?.name || "Unknown Plan"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(assignment.effective_start_date), "MMM yyyy")} -{" "}
                          {format(new Date(assignment.effective_end_date), "MMM yyyy")}
                        </div>
                        {assignment.ote_usd && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            OTE: ${assignment.ote_usd.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditAssignment(assignment)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setDeletingAssignment(assignment)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>

      {/* Assign/Edit Dialog */}
      <PlanAssignmentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        employee={employee}
        existingAssignment={editingAssignment}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingAssignment}
        onOpenChange={(open) => !open && setDeletingAssignment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this plan assignment? This action cannot be undone.
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
