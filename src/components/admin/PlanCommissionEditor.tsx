import { useState } from "react";
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
import { Plus, Edit, Trash2, Loader2, DollarSign } from "lucide-react";
import {
  usePlanCommissions,
  useCreatePlanCommission,
  useUpdatePlanCommission,
  useDeletePlanCommission,
  PlanCommission,
} from "@/hooks/usePlanCommissions";
import { CommissionFormDialog } from "./CommissionFormDialog";

interface PlanCommissionEditorProps {
  planId: string;
}

export function PlanCommissionEditor({ planId }: PlanCommissionEditorProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCommission, setEditingCommission] = useState<PlanCommission | null>(null);
  const [deletingCommission, setDeletingCommission] = useState<PlanCommission | null>(null);

  const { data: commissions = [], isLoading } = usePlanCommissions(planId);
  const createMutation = useCreatePlanCommission();
  const updateMutation = useUpdatePlanCommission();
  const deleteMutation = useDeletePlanCommission();

  const existingTypes = commissions.map((c) => c.commission_type);

  const handleAdd = () => {
    setEditingCommission(null);
    setShowDialog(true);
  };

  const handleEdit = (commission: PlanCommission) => {
    setEditingCommission(commission);
    setShowDialog(true);
  };

  const handleSubmit = (values: {
    commission_type: string;
    commission_rate_pct: number;
    min_threshold_usd?: number | null;
    is_active?: boolean;
    payout_on_booking_pct?: number;
    payout_on_collection_pct?: number;
  }) => {
    if (editingCommission) {
      updateMutation.mutate(
        {
          id: editingCommission.id,
          plan_id: planId,
          commission_rate_pct: values.commission_rate_pct,
          min_threshold_usd: values.min_threshold_usd,
          is_active: values.is_active,
          payout_on_booking_pct: values.payout_on_booking_pct,
          payout_on_collection_pct: values.payout_on_collection_pct,
        },
        {
          onSuccess: () => {
            setShowDialog(false);
            setEditingCommission(null);
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          plan_id: planId,
          commission_type: values.commission_type,
          commission_rate_pct: values.commission_rate_pct,
          min_threshold_usd: values.min_threshold_usd,
          is_active: values.is_active,
          payout_on_booking_pct: values.payout_on_booking_pct,
          payout_on_collection_pct: values.payout_on_collection_pct,
        },
        {
          onSuccess: () => {
            setShowDialog(false);
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deletingCommission) {
      deleteMutation.mutate(
        { id: deletingCommission.id, plan_id: planId },
        {
          onSuccess: () => setDeletingCommission(null),
        }
      );
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Always allow adding more commission types (including custom ones)
  const canAddMore = true;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Commission Structure</CardTitle>
              <CardDescription>
                Configure commission rates for deal types applicable to this plan
              </CardDescription>
            </div>
            <Button variant="accent" onClick={handleAdd} disabled={!canAddMore}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Commission
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Commissions Configured</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Add commission types to enable deal-based commission calculations for employees on this plan.
              </p>
              <Button variant="accent" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add First Commission
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commission Type</TableHead>
                  <TableHead className="text-center">Rate (%)</TableHead>
                  <TableHead className="text-center">Min Threshold</TableHead>
                  <TableHead className="text-center">Payout Split</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">{commission.commission_type}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={commission.commission_rate_pct === 0 ? "secondary" : "outline"}
                      >
                        {commission.commission_rate_pct}%
                        {commission.commission_rate_pct === 0 && (
                          <span className="ml-1 text-xs opacity-70">(placeholder)</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatCurrency(commission.min_threshold_usd)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center text-xs">
                        <span className="text-muted-foreground">
                          {commission.payout_on_booking_pct ?? 75}% Booking
                        </span>
                        <span className="text-muted-foreground">
                          {commission.payout_on_collection_pct ?? 25}% Collection
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {commission.is_active ? (
                        <Badge className="bg-success/10 text-success">Active</Badge>
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
                          onClick={() => handleEdit(commission)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingCommission(commission)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <CommissionFormDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingCommission(null);
        }}
        commission={editingCommission}
        existingTypes={existingTypes}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={!!deletingCommission}
        onOpenChange={(open) => !open && setDeletingCommission(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Commission Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deletingCommission?.commission_type}" from this
              plan? This action cannot be undone.
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
