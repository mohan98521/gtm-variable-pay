import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { UnifiedAuditEntry } from "@/hooks/useUnifiedAuditLog";
import { getTableLabel, getDomainColor } from "@/hooks/useUnifiedAuditLog";
import { AuditDetailPanel } from "./AuditDetailPanel";

interface AuditTimelineProps {
  entries: UnifiedAuditEntry[];
  employeeMap: Map<string, string>;
  userMap: Map<string, string>;
  maxItems?: number;
}

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "DELETE" || action === "deleted" || action.includes("mismatch") || action.includes("clawback")) return "destructive";
  if (action === "INSERT" || action === "CREATE" || action === "created" || action.includes("approved") || action.includes("finalized")) return "default";
  if (action.includes("rejected")) return "secondary";
  return "outline";
}

export function AuditTimeline({ entries, employeeMap, userMap, maxItems = 200 }: AuditTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayed = useMemo(() => entries.slice(0, maxItems), [entries, maxItems]);

  return (
    <>
      <ScrollArea className="w-full whitespace-nowrap">
        <Table>
          <TableHeader>
            <TableRow className="bg-[hsl(var(--azentio-navy))]">
              <TableHead className="text-white w-8"></TableHead>
              <TableHead className="text-white">Timestamp</TableHead>
              <TableHead className="text-white">Domain</TableHead>
              <TableHead className="text-white">Table</TableHead>
              <TableHead className="text-white">Action</TableHead>
              <TableHead className="text-white">Changed By</TableHead>
              <TableHead className="text-white">Details</TableHead>
              <TableHead className="text-white">Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : entry.id)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/50 ${
                          entry.is_rate_mismatch ? "bg-destructive/5" : entry.is_retroactive ? "bg-warning/5" : ""
                        }`}
                      >
                        <TableCell className="w-8 p-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(entry.changed_at), "MMM dd, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getDomainColor(entry.domain)} text-xs`}>
                            {entry.domain}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{getTableLabel(entry.table_name)}</TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(entry.action)} className="text-xs">
                            {entry.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.changed_by ? (userMap.get(entry.changed_by) || entry.changed_by.substring(0, 8) + "...") : "System"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {getQuickDetail(entry)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {entry.is_retroactive && <Badge variant="destructive" className="text-xs">Retro</Badge>}
                            {entry.is_rate_mismatch && <Badge variant="destructive" className="text-xs">Mismatch</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-4 bg-muted/20">
                          <CollapsibleContent>
                            <AuditDetailPanel
                              entry={entry}
                              employeeName={entry.employee_id ? employeeMap.get(entry.employee_id) : undefined}
                              changedByName={entry.changed_by ? userMap.get(entry.changed_by) : undefined}
                            />
                          </CollapsibleContent>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {entries.length > maxItems && (
        <p className="text-center text-muted-foreground py-4 text-sm">
          Showing {maxItems} of {entries.length} entries. Export for full data.
        </p>
      )}
      {entries.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No audit entries found</p>
      )}
    </>
  );
}

function getQuickDetail(entry: UnifiedAuditEntry): string {
  if (entry.amount_usd) return `$${entry.amount_usd.toLocaleString()}`;
  if (entry.new_values?.run_status) return `Status → ${entry.new_values.run_status}`;
  if (entry.new_values?.full_name) return String(entry.new_values.full_name);
  if (entry.new_values?.name) return String(entry.new_values.name);
  if (entry.new_values?.metric_name) return String(entry.new_values.metric_name);
  if (entry.new_values?.customer_name) return String(entry.new_values.customer_name);
  if (entry.new_values?.role) return `Role: ${entry.new_values.role}`;
  if (entry.reason) return entry.reason;
  return "—";
}
