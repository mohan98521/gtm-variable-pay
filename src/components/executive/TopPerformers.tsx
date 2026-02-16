import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { TopPerformer } from "@/hooks/useExecutiveDashboard";

interface TopPerformersProps {
  data: TopPerformer[];
  isLoading: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function achBadgeClass(pct: number): string {
  if (pct >= 100) return "border-success text-success";
  if (pct >= 80) return "border-warning text-warning";
  return "border-destructive text-destructive";
}

const rankColors = ["bg-warning text-warning-foreground", "bg-muted text-muted-foreground", "bg-muted text-muted-foreground"];

export function TopPerformers({ data, isLoading }: TopPerformersProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Top Performers</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          Top 5 Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Role / Region</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead className="text-right">Software %</TableHead>
              <TableHead className="text-right">Closing ARR %</TableHead>
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p, i) => (
              <TableRow key={p.employeeId}>
                <TableCell>
                  <Badge variant="outline" className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${i < 3 ? rankColors[i] : ""}`}>
                    {i + 1}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {getInitials(p.fullName)}
                    </div>
                    <span className="font-medium text-sm">{p.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {p.role || p.salesFunction}{p.region ? ` · ${p.region}` : ""}
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {formatCompact(p.totalPayout)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={`text-xs ${achBadgeClass(p.softwareArrAchPct ?? 0)}`}>
                    {(p.softwareArrAchPct ?? 0).toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={`text-xs ${achBadgeClass(p.closingArrAchPct ?? 0)}`}>
                    {(p.closingArrAchPct ?? 0).toFixed(0)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No payout data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground px-4 py-3 border-t">
          Payouts from finalized monthly payout runs. Achievement from deal actuals vs performance targets.
        </p>
      </CardContent>
    </Card>
  );
}
