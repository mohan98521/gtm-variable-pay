import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, Calendar, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock data for monthly actuals input
const monthlyData = [
  {
    id: "1",
    userName: "Sarah Johnson",
    metric: "New Software Sales",
    month: "2025-08",
    value: 52500,
    status: "submitted",
  },
  {
    id: "2",
    userName: "Sarah Johnson",
    metric: "Closing ARR",
    month: "2025-08",
    value: 28000,
    status: "submitted",
  },
  {
    id: "3",
    userName: "Michael Chen",
    metric: "Retention Rate",
    month: "2025-08",
    value: 95.5,
    status: "pending",
  },
  {
    id: "4",
    userName: "Michael Chen",
    metric: "Upsell Revenue",
    month: "2025-08",
    value: 18500,
    status: "pending",
  },
  {
    id: "5",
    userName: "Emily Rodriguez",
    metric: "New Software Sales",
    month: "2025-08",
    value: 68000,
    status: "submitted",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "submitted":
      return (
        <Badge className="bg-success/10 text-success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
};

export default function DataInputs() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Data Inputs</h1>
            <p className="text-muted-foreground">Upload and manage monthly actuals</p>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="2025-08">
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-08">August 2025</SelectItem>
                <SelectItem value="2025-07">July 2025</SelectItem>
                <SelectItem value="2025-06">June 2025</SelectItem>
                <SelectItem value="2025-05">May 2025</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
            <Button variant="accent">
              <Save className="h-4 w-4 mr-1.5" />
              Save All
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-semibold text-foreground">{monthlyData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {monthlyData.filter(d => d.status === "submitted").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {monthlyData.filter(d => d.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Selected Period</p>
                <p className="text-lg font-semibold text-foreground">August 2025</p>
                <p className="text-xs text-muted-foreground">FY 2025 Q3</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Entry Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Actuals</CardTitle>
            <CardDescription>Enter or edit performance data for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((entry) => (
                  <TableRow key={entry.id} className="data-row">
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {entry.metric}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.month}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        defaultValue={entry.value}
                        className="w-32 text-right ml-auto"
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Save className="h-4 w-4 mr-1" />
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exchange Rates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exchange Rates</CardTitle>
            <CardDescription>Currency conversion rates for multi-currency calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { currency: "EUR", rate: 1.08 },
                { currency: "GBP", rate: 1.26 },
                { currency: "INR", rate: 0.012 },
                { currency: "SGD", rate: 0.74 },
              ].map((rate) => (
                <div key={rate.currency} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted font-semibold text-sm">
                    {rate.currency}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.0001"
                      defaultValue={rate.rate}
                      className="h-8 text-sm"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">to USD</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}