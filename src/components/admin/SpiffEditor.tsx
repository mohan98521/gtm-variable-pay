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
import { Plus, Edit, Trash2, Loader2, Zap } from "lucide-react";
import {
  usePlanSpiffs,
  useCreatePlanSpiff,
  useUpdatePlanSpiff,
  useDeletePlanSpiff,
  PlanSpiff,
} from "@/hooks/usePlanSpiffs";
import { SpiffFormDialog } from "./SpiffFormDialog";

interface SpiffEditorProps {
  planId: string;
  metricNames: string[];
}

export function SpiffEditor({ planId, metricNames }: SpiffEditorProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSpiff, setEditingSpiff] = useState<PlanSpiff | null>(null);
  const [deletingSpiff, setDeletingSpiff] = useState<PlanSpiff | null>(null);

  const { data: spiffs = [], isLoading } = usePlanSpiffs(planId);
  const createMutation = useCreatePlanSpiff();
  const updateMutation = useUpdatePlanSpiff();
  const deleteMutation = useDeletePlanSpiff();

  const handleAdd = () => {
    setEditingSpiff(null);
    setShowDialog(true);
  };

  const handleEdit = (spiff: PlanSpiff) => {
    setEditingSpiff(spiff);
    setShowDialog(true);
  };

  const handleSubmit = (values: {
    spiff_name: string;
    description?: string | null;
    linked_metric_name: string;
    spiff_rate_pct: number;
    min_deal_value_usd?: number | null;
    is_active: boolean;
  }) => {
    if (editingSpiff) {
      updateMutation.mutate(
        { ...values, id: editingSpiff.id, plan_id: planId },
        { onSuccess: () => { setShowDialog(false); setEditingSpiff(null); } }
      );
    } else {
      createMutation.mutate(
        { ...values, plan_id: planId },
        { onSuccess: () => setShowDialog(false) }
      );
    }
  };

  const handleDelete = () => {
    if (deletingSpiff) {
      deleteMutation.mutate(
        { id: deletingSpiff.id, plan_id: planId },
        { onSuccess: () => setDeletingSpiff(null) }
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10 text-warning">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">SPIFFs</CardTitle>
                <CardDescription>
                  Configurable bonus structures linked to Variable OTE
                </CardDescription>
              </div>
            </div>
            <Button variant="accent" onClick={handleAdd} disabled={metricNames.length === 0}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add SPIFF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metricNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Add plan metrics first before configuring SPIFFs.
              </p>
            </div>
          ) : spiffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No SPIFFs Configured</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Add SPIFFs to enable deal-level bonus calculations for employees on this plan.
              </p>
              <Button variant="accent" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add First SPIFF
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SPIFF Name</TableHead>
                  <TableHead>Linked Metric</TableHead>
                  <TableHead className="text-center">Rate (%)</TableHead>
                  <TableHead className="text-center">Min Deal Value</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spiffs.map((spiff) => (
                  <TableRow key={spiff.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{spiff.spiff_name}</span>
                        {spiff.description && (
                          <p className="text-xs text-muted-foreground">{spiff.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{spiff.linked_metric_name}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{spiff.spiff_rate_pct}%</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatCurrency(spiff.min_deal_value_usd)}
                    </TableCell>
                    <TableCell className="text-center">
                      {spiff.is_active ? (
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
                          onClick={() => handleEdit(spiff)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingSpiff(spiff)}
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

      <SpiffFormDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingSpiff(null);
        }}
        spiff={editingSpiff}
        metricNames={metricNames}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={!!deletingSpiff}
        onOpenChange={(open) => !open && setDeletingSpiff(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SPIFF</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deletingSpiff?.spiff_name}" from this plan?
              This action cannot be undone.
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
