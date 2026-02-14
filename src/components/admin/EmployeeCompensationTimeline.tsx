import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, ArrowRight, FileText, Target } from "lucide-react";
import { useEmployeeChangeLog, type EmployeeChangeLogEntry } from "@/hooks/useEmployeeChangeLog";
import { useEmployeePlanAssignments } from "@/hooks/usePlanAssignments";
import { format } from "date-fns";

interface EmployeeCompensationTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  employeeUserId?: string;
}

const CHANGE_TYPE_COLORS: Record<string, string> = {
  hike: "bg-success/10 text-success",
  promotion: "bg-primary/10 text-primary",
  transfer: "bg-warning/10 text-warning",
  correction: "bg-muted text-muted-foreground",
  new_joiner: "bg-accent/10 text-accent-foreground",
  departure: "bg-destructive/10 text-destructive",
};

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

interface TimelineItem {
  date: string;
  type: "change" | "assignment";
  data: EmployeeChangeLogEntry | any;
}

export function EmployeeCompensationTimeline({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  employeeUserId,
}: EmployeeCompensationTimelineProps) {
  const { data: changeLogs, isLoading: loadingChanges } = useEmployeeChangeLog(employeeId);
  const { data: assignments, isLoading: loadingAssignments } = useEmployeePlanAssignments(employeeUserId);

  const isLoading = loadingChanges || loadingAssignments;

  // Merge and sort timeline items
  const timelineItems: TimelineItem[] = [];

  changeLogs?.forEach((log) => {
    timelineItems.push({
      date: log.effective_date,
      type: "change",
      data: log,
    });
  });

  assignments?.forEach((assignment) => {
    timelineItems.push({
      date: assignment.effective_start_date,
      type: "assignment",
      data: assignment,
    });
  });

  // Sort by date descending
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Compensation History
          </DialogTitle>
          <DialogDescription>
            Timeline of compensation changes and plan assignments for{" "}
            <strong>{employeeName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No compensation changes or plan assignments recorded yet.</p>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

            {timelineItems.map((item, index) => (
              <div key={index} className="relative pl-10 pb-6">
                {/* Timeline dot */}
                <div
                  className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                    item.type === "change" ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />

                {item.type === "change" ? (
                  <ChangeLogItem entry={item.data as EmployeeChangeLogEntry} />
                ) : (
                  <AssignmentItem assignment={item.data} />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChangeLogItem({ entry }: { entry: EmployeeChangeLogEntry }) {
  const changes = entry.field_changes || {};
  const changeEntries = Object.entries(changes);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={CHANGE_TYPE_COLORS[entry.change_type] || "bg-muted"}>
            {entry.change_type.replace("_", " ").toUpperCase()}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.effective_date), "MMM d, yyyy")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Logged {format(new Date(entry.changed_at), "MMM d, yyyy h:mm a")}
        </span>
      </div>

      {changeEntries.length > 0 && (
        <div className="space-y-1">
          {changeEntries.map(([field, { old: oldVal, new: newVal }]) => (
            <div key={field} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground min-w-[130px] text-xs">
                {formatFieldName(field)}
              </span>
              <span className="font-mono text-xs">{formatValue(oldVal)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-xs font-medium">{formatValue(newVal)}</span>
            </div>
          ))}
        </div>
      )}

      {entry.change_reason && (
        <p className="text-xs text-muted-foreground italic">
          Reason: {entry.change_reason}
        </p>
      )}
    </div>
  );
}

function AssignmentItem({ assignment }: { assignment: any }) {
  const planName = (assignment.comp_plans as any)?.name || "Unknown Plan";
  const year = (assignment.comp_plans as any)?.effective_year || "";

  return (
    <div className="rounded-md border border-dashed p-3 space-y-1 bg-muted/20">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Plan Assignment</span>
        <span className="text-sm text-muted-foreground">
          {format(new Date(assignment.effective_start_date), "MMM d, yyyy")} —{" "}
          {format(new Date(assignment.effective_end_date), "MMM d, yyyy")}
        </span>
      </div>
      <div className="text-sm">
        <strong>{planName}</strong> ({year})
        {assignment.ote_usd != null && (
          <span className="ml-2 text-muted-foreground">
            OTE: ${assignment.ote_usd?.toLocaleString()}
          </span>
        )}
        {assignment.target_bonus_usd != null && (
          <span className="ml-2 text-muted-foreground">
            Bonus: ${assignment.target_bonus_usd?.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
