import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowRight, GitBranch, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { ChangeType } from "@/hooks/useEmployeeChangeLog";

interface ActiveAssignment {
  id: string;
  plan_id: string;
  plan_name: string;
  effective_start_date: string;
  effective_end_date: string;
  ote_usd: number | null;
  target_bonus_usd: number | null;
}

interface CompensationChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  fieldChanges: Record<string, { old: unknown; new: unknown }>;
  activeAssignment: ActiveAssignment | null;
  onConfirm: (params: {
    changeType: ChangeType;
    effectiveDate: string;
    changeReason: string;
    splitAssignment: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const CHANGE_TYPE_OPTIONS: { value: ChangeType; label: string }[] = [
  { value: "hike", label: "Hike / Increment" },
  { value: "promotion", label: "Promotion" },
  { value: "transfer", label: "Transfer / Movement" },
  { value: "correction", label: "Correction" },
];

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Usd", "(USD)")
    .replace("Local Currency", "(Local)");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function CompensationChangeDialog({
  open,
  onOpenChange,
  employeeName,
  fieldChanges,
  activeAssignment,
  onConfirm,
  isSubmitting,
}: CompensationChangeDialogProps) {
  const [changeType, setChangeType] = useState<ChangeType>("hike");
  const [effectiveDate, setEffectiveDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [changeReason, setChangeReason] = useState("");
  const [splitAssignment, setSplitAssignment] = useState(true);

  const handleConfirm = async () => {
    await onConfirm({
      changeType,
      effectiveDate,
      changeReason,
      splitAssignment: splitAssignment && !!activeAssignment,
    });
  };

  const changedFields = Object.entries(fieldChanges);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Compensation Change Detected
          </DialogTitle>
          <DialogDescription>
            You are changing compensation fields for <strong>{employeeName}</strong>.
            Please provide details for audit tracking.
          </DialogDescription>
        </DialogHeader>

        {/* Changed Fields Summary */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fields Being Changed</Label>
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            {changedFields.map(([field, { old: oldVal, new: newVal }]) => (
              <div key={field} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground min-w-[140px]">
                  {formatFieldName(field)}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatValue(oldVal)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="default" className="font-mono text-xs">
                  {formatValue(newVal)}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Change Type */}
        <div className="space-y-2">
          <Label htmlFor="change-type">Change Type *</Label>
          <Select value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANGE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Effective Date */}
        <div className="space-y-2">
          <Label htmlFor="effective-date">Effective Date *</Label>
          <Input
            id="effective-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="change-reason">Reason / Notes</Label>
          <Textarea
            id="change-reason"
            placeholder="e.g., Annual performance review, role upgrade..."
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            rows={2}
          />
        </div>

        {/* Split Assignment Option */}
        {activeAssignment && (
          <>
            <Separator />
            <div className="rounded-md border p-3 space-y-3 bg-accent/10">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Active Plan Assignment</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>{activeAssignment.plan_name}</strong>
                </p>
                <p>
                  {format(new Date(activeAssignment.effective_start_date), "MMM d, yyyy")} —{" "}
                  {format(new Date(activeAssignment.effective_end_date), "MMM d, yyyy")}
                </p>
                {activeAssignment.ote_usd != null && (
                  <p>OTE: ${activeAssignment.ote_usd.toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitAssignment}
                    onChange={(e) => setSplitAssignment(e.target.checked)}
                    className="rounded"
                  />
                  Split assignment at effective date with updated compensation
                </label>
              </div>
              {splitAssignment && (
                <p className="text-xs text-muted-foreground">
                  The current assignment will end on{" "}
                  {effectiveDate
                    ? format(
                        new Date(new Date(effectiveDate).getTime() - 86400000),
                        "MMM d, yyyy"
                      )
                    : "the day before"}{" "}
                  and a new assignment with updated OTE will start on{" "}
                  {effectiveDate
                    ? format(new Date(effectiveDate), "MMM d, yyyy")
                    : "the effective date"}
                  .
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || !changeType || !effectiveDate}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm & Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
