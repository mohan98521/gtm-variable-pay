import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { TeamMemberCompensation } from "@/hooks/useTeamCompensation";
import { TeamMemberDetail } from "./TeamMemberDetail";

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};

const getInitials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").substring(0, 2);

const getStatusBadge = (status: string) => {
  switch (status) {
    case "on-track":
      return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">On Track</Badge>;
    case "at-risk":
      return <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">At Risk</Badge>;
    case "behind":
      return <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20">Behind</Badge>;
    default:
      return null;
  }
};

interface TeamPerformanceTableProps {
  members: TeamMemberCompensation[];
}

export function TeamPerformanceTable({ members }: TeamPerformanceTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (employeeId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Team Performance Overview</CardTitle>
        <CardDescription>Click any row to expand metric-level details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="font-semibold">Employee</TableHead>
                <TableHead className="font-semibold">Plan</TableHead>
                <TableHead className="text-right font-semibold">Target (TVP)</TableHead>
                <TableHead className="font-semibold w-36">Achievement</TableHead>
                <TableHead className="text-right font-semibold">Eligible Payout</TableHead>
                <TableHead className="text-right font-semibold">Paid</TableHead>
                <TableHead className="text-right font-semibold">Holdback</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No team members reporting to you
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const isExpanded = expandedRows.has(member.employeeId);
                  const totalEligible = member.totalEligiblePayout + member.totalCommissionPayout + (member.nrrResult?.payoutUsd || 0) + (member.spiffResult?.totalSpiffUsd || 0);
                  const totalPaid = member.totalPaid + member.totalCommissionPaid + (member.nrrResult?.payoutUsd || 0) + (member.spiffResult?.totalSpiffUsd || 0) - member.clawbackAmount;
                  const totalHoldback = member.totalHoldback + member.totalCommissionHoldback +
                    member.totalYearEndHoldback + member.totalCommissionYearEndHoldback;

                  return (
                    <Collapsible key={member.employeeId} open={isExpanded} onOpenChange={() => toggleRow(member.employeeId)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <TableCell className="w-8 px-2">
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {getInitials(member.employeeName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{member.employeeName}</p>
                                  {member.designation && (
                                    <p className="text-xs text-muted-foreground">{member.designation}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal text-xs">
                                {member.planName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {formatCurrency(member.targetBonusUsd)}
                            </TableCell>
                            <TableCell className="w-36">
                              <div className="flex items-center gap-2">
                                <ProgressBar
                                  value={member.overallAchievementPct}
                                  max={100}
                                  showLabel={false}
                                  size="sm"
                                />
                                <span className={`text-sm font-semibold w-14 text-right ${
                                  member.overallAchievementPct >= 100 ? "text-success"
                                    : member.overallAchievementPct >= 85 ? "text-warning"
                                    : "text-destructive"
                                }`}>
                                  {member.overallAchievementPct.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">
                              {formatCurrency(totalEligible)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-success font-medium">
                              {formatCurrency(totalPaid)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatCurrency(totalHoldback)}
                            </TableCell>
                            <TableCell>{getStatusBadge(member.status)}</TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={9} className="p-0">
                              <div className="bg-muted/20 border-t px-6 py-4">
                                <TeamMemberDetail
                                  metrics={member.metrics}
                                  commissions={member.commissions}
                                  totalEligiblePayout={member.totalEligiblePayout}
                                  totalPaid={member.totalPaid}
                                  totalHoldback={member.totalHoldback}
                                  totalYearEndHoldback={member.totalYearEndHoldback}
                                  totalCommissionPayout={member.totalCommissionPayout}
                                  totalCommissionPaid={member.totalCommissionPaid}
                                  totalCommissionHoldback={member.totalCommissionHoldback}
                                  totalCommissionYearEndHoldback={member.totalCommissionYearEndHoldback}
                                  nrrResult={member.nrrResult}
                                  nrrOtePct={member.nrrOtePct}
                                  spiffResult={member.spiffResult}
                                  clawbackAmount={member.clawbackAmount}
                                />
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
