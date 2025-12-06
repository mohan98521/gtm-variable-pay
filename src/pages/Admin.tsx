import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Users, Layers, ArrowRight, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock comp plans data
const compPlans = [
  {
    id: "1",
    name: "Hunter 2025",
    description: "New business acquisition focused plan with accelerators",
    metrics: ["New Software Sales", "Closing ARR"],
    assignedUsers: 15,
    isActive: true,
  },
  {
    id: "2",
    name: "Farmer Split 60/40",
    description: "Account management with 60/40 split between retention and upsell",
    metrics: ["Retention Rate", "Upsell Revenue"],
    assignedUsers: 12,
    isActive: true,
  },
  {
    id: "3",
    name: "SDR Monthly",
    description: "Monthly targets for sales development representatives",
    metrics: ["Qualified Meetings", "Pipeline Generated"],
    assignedUsers: 8,
    isActive: true,
  },
  {
    id: "4",
    name: "CSM Quarterly",
    description: "Customer success managers with quarterly NRR targets",
    metrics: ["Net Revenue Retention", "Customer Health Score"],
    assignedUsers: 6,
    isActive: false,
  },
];

export default function Admin() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Plan Configuration</h1>
            <p className="text-muted-foreground">Create and manage compensation plans</p>
          </div>
          <Button variant="accent">
            <Plus className="h-4 w-4 mr-1.5" />
            Create New Plan
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Plans</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {compPlans.filter(p => p.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {compPlans.reduce((sum, p) => sum + p.assignedUsers, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metric Types</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {new Set(compPlans.flatMap(p => p.metrics)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compensation Plans</CardTitle>
            <CardDescription>Configure plan structures, metrics, and multiplier grids</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-center">Assigned Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compPlans.map((plan) => (
                  <TableRow key={plan.id} className="data-row">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {plan.metrics.map((metric) => (
                          <Badge key={metric} variant="outline" className="text-xs">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{plan.assignedUsers}</span>
                    </TableCell>
                    <TableCell>
                      {plan.isActive ? (
                        <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Plan Builder Placeholder */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Plan Builder</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Create custom compensation plans with multiple metrics, split weightings, 
              gate thresholds, and accelerator multipliers.
            </p>
            <Button variant="accent">
              <Plus className="h-4 w-4 mr-1.5" />
              Start Building
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}