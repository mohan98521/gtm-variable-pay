import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useClosingArrRenewalMultipliers,
  useCreateClosingArrRenewalMultiplier,
  useUpdateClosingArrRenewalMultiplier,
  useDeleteClosingArrRenewalMultiplier,
  ClosingArrRenewalMultiplier,
} from "@/hooks/useClosingArrRenewalMultipliers";

interface Props {
  planId: string;
}

export function ClosingArrRenewalMultiplierEditor({ planId }: Props) {
  const { data: multipliers = [], isLoading } = useClosingArrRenewalMultipliers(planId);
  const createMutation = useCreateClosingArrRenewalMultiplier();
  const updateMutation = useUpdateClosingArrRenewalMultiplier();
  const deleteMutation = useDeleteClosingArrRenewalMultiplier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClosingArrRenewalMultiplier | null>(null);
  const [deleting, setDeleting] = useState<ClosingArrRenewalMultiplier | null>(null);

  const [minYears, setMinYears] = useState(1);
  const [maxYears, setMaxYears] = useState<string>("");
  const [multiplierValue, setMultiplierValue] = useState(1.0);

  const openAdd = () => {
    setEditing(null);
    setMinYears(1);
    setMaxYears("");
    setMultiplierValue(1.0);
    setDialogOpen(true);
  };

  const openEdit = (m: ClosingArrRenewalMultiplier) => {
    setEditing(m);
    setMinYears(m.min_years);
    setMaxYears(m.max_years !== null ? String(m.max_years) : "");
    setMultiplierValue(m.multiplier_value);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const newMin = minYears;
    const newMax = maxYears ? parseInt(maxYears) : null;

    // Validate overlap against existing tiers (excluding the one being edited)
    const otherTiers = multipliers.filter((m) => !editing || m.id !== editing.id);
    const overlap = otherTiers.find((m) => {
      const existingMax = m.max_years ?? Infinity;
      const currentMax = newMax ?? Infinity;
      return newMin <= existingMax && currentMax >= m.min_years;
    });

    if (overlap) {
      toast.error(
        `Range ${newMin}–${newMax ?? "∞"} overlaps with existing tier ${overlap.min_years}–${overlap.max_years ?? "∞"}. Adjust ranges to avoid overlap.`
      );
      return;
    }

    const values = {
      plan_id: planId,
      min_years: newMin,
      max_years: newMax,
      multiplier_value: multiplierValue,
    };

    if (editing) {
      updateMutation.mutate({ ...values, id: editing.id }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(values, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (deleting) {
      deleteMutation.mutate({ id: deleting.id, plan_id: planId }, { onSuccess: () => setDeleting(null) });
    }
  };

  const formatRange = (m: ClosingArrRenewalMultiplier) => {
    if (m.max_years === null) return `${m.min_years}+ years`;
    if (m.min_years === m.max_years) return `${m.min_years} year${m.min_years > 1 ? "s" : ""}`;
    return `${m.min_years}–${m.max_years} years`;
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Closing ARR Renewal Multipliers
              </CardTitle>
              <CardDescription>
                Configure multipliers applied to Closing ARR based on multi-year renewal periods
              </CardDescription>
            </div>
            <Button variant="accent" size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Formula:</strong> Adjusted Closing ARR = Closing ARR × Renewal Multiplier (based on number of renewal years).
              Records marked as "Multi-Year" in the Closing ARR data will have their value multiplied by the matching tier.
            </AlertDescription>
          </Alert>

          {multipliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No Renewal Multipliers Configured</p>
              <p className="text-sm mt-1">Add tiers to define multipliers for multi-year renewals.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Renewal Years Range</TableHead>
                  <TableHead className="text-center">Multiplier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multipliers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{formatRange(m)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{m.multiplier_value}x</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(m)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Renewal Multiplier" : "Add Renewal Multiplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Years</Label>
                <Input type="number" min={1} value={minYears} onChange={(e) => setMinYears(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Max Years (blank = unlimited)</Label>
                <Input type="number" min={1} value={maxYears} onChange={(e) => setMaxYears(e.target.value)} placeholder="No limit" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Multiplier Value</Label>
              <Input type="number" step="0.01" min={0} value={multiplierValue} onChange={(e) => setMultiplierValue(parseFloat(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">E.g., 1.0 = no change, 1.1 = 10% boost, 1.2 = 20% boost</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Renewal Multiplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the {deleting && formatRange(deleting)} tier? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
