import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Users, TrendingUp, TrendingDown, Minus, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Mock team data
const teamMembers = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    plan: "Hunter 2025",
    target: 500000,
    achieved: 425000,
    status: "on-track",
    trend: "up",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael.chen@company.com",
    plan: "Farmer Split 60/40",
    target: 400000,
    achieved: 298000,
    status: "at-risk",
    trend: "neutral",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily.rodriguez@company.com",
    plan: "Hunter 2025",
    target: 550000,
    achieved: 512000,
    status: "on-track",
    trend: "up",
  },
  {
    id: "4",
    name: "David Kim",
    email: "david.kim@company.com",
    plan: "Farmer Split 60/40",
    target: 450000,
    achieved: 285000,
    status: "behind",
    trend: "down",
  },
  {
    id: "5",
    name: "Jessica Williams",
    email: "jessica.williams@company.com",
    plan: "Hunter 2025",
    target: 480000,
    achieved: 445000,
    status: "on-track",
    trend: "up",
  },
];

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("");
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "on-track":
      return <Badge className="status-badge status-on-track">On Track</Badge>;
    case "at-risk":
      return <Badge className="status-badge status-at-risk">At Risk</Badge>;
    case "behind":
      return <Badge className="status-badge status-behind">Behind</Badge>;
    default:
      return null;
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-success" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function TeamView() {
  const totalTarget = teamMembers.reduce((sum, m) => sum + m.target, 0);
  const totalAchieved = teamMembers.reduce((sum, m) => sum + m.achieved, 0);
  const teamPct = (totalAchieved / totalTarget) * 100;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Team View</h1>
            <p className="text-muted-foreground">Monitor your direct reports' performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1.5" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Team Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-2xl font-semibold text-foreground">{teamMembers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Team Achievement</p>
                <p className="text-2xl font-semibold text-foreground">{teamPct.toFixed(1)}%</p>
                <ProgressBar value={totalAchieved} max={totalTarget} showLabel={false} size="sm" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-foreground">
                  ${totalAchieved.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Target: ${totalTarget.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Direct Reports</CardTitle>
            <CardDescription>Performance summary for your team members</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Comp Plan</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Achieved</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => {
                  const pct = (member.achieved / member.target) * 100;
                  return (
                    <TableRow key={member.id} className="data-row">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {member.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${member.target.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${member.achieved.toLocaleString()}
                      </TableCell>
                      <TableCell className="w-32">
                        <div className="flex items-center gap-2">
                          <ProgressBar 
                            value={member.achieved} 
                            max={member.target} 
                            showLabel={false} 
                            size="sm" 
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell className="text-center">{getTrendIcon(member.trend)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}