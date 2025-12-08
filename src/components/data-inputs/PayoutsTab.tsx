import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, Clock, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvUploadDialog } from "./CsvUploadDialog";
import { useMonthlyPayouts, useInsertMonthlyPayouts } from "@/hooks/useMonthlyPayouts";
import { useEmployees } from "@/hooks/useEmployees";

interface PayoutsTabProps {
  selectedMonth: string;
}

export function PayoutsTab({ selectedMonth }: PayoutsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: payouts, isLoading } = useMonthlyPayouts(selectedMonth);
  const { data: employees } = useEmployees();
  const insertMutation = useInsertMonthlyPayouts();

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) || []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-success/10 text-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-primary/10 text-primary">
            <DollarSign className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "calculated":
        return (
          <Badge className="bg-warning/10 text-warning">
            <Clock className="h-3 w-3 mr-1" />
            Calculated
          </Badge>
        );
      case "held":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Held
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCsvUpload = async (data: Record<string, string>[]) => {
    const payoutsToInsert = data.map((row) => ({
      employee_id: row.employee_id,
      month_year: selectedMonth,
      payout_type: row.payout_type,
      calculated_amount_usd: parseFloat(row.calculated_amount_usd) || 0,
      paid_amount_usd: row.paid_amount_usd ? parseFloat(row.paid_amount_usd) : null,
      holdback_amount_usd: row.holdback_amount_usd ? parseFloat(row.holdback_amount_usd) : null,
      status: row.status || "calculated",
      notes: row.notes || null,
    }));

    await insertMutation.mutateAsync(payoutsToInsert);
  };

  const validateRow = (row: Record<string, string>, index: number): string | null => {
    if (!row.employee_id) return "Employee ID is required";
    if (!row.payout_type) return "Payout type is required";
    if (!row.calculated_amount_usd || isNaN(parseFloat(row.calculated_amount_usd))) {
      return "Valid calculated amount (USD) is required";
    }
    if (!employeeMap.has(row.employee_id)) {
      return `Employee ID "${row.employee_id}" not found`;
    }
    return null;
  };

  const templateColumns = [
    "employee_id",
    "payout_type",
    "calculated_amount_usd",
    "paid_amount_usd",
    "holdback_amount_usd",
    "status",
    "notes",
  ];

  // Calculate summary stats
  const totalCalculated = payouts?.reduce((sum, p) => sum + p.calculated_amount_usd, 0) || 0;
  const totalPaid = payouts?.reduce((sum, p) => sum + (p.paid_amount_usd || 0), 0) || 0;
  const totalHoldback = payouts?.reduce((sum, p) => sum + (p.holdback_amount_usd || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Monthly Payouts</h3>
          <p className="text-sm text-muted-foreground">
            Track calculated, approved, and paid amounts
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Calculated</div>
            <div className="text-2xl font-semibold">${totalCalculated.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Paid (75%)</div>
            <div className="text-2xl font-semibold text-success">${totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Holdback (25%)</div>
            <div className="text-2xl font-semibold text-warning">${totalHoldback.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : payouts && payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Payout Type</TableHead>
                  <TableHead className="text-right">Calculated</TableHead>
                  <TableHead className="text-right">Paid (75%)</TableHead>
                  <TableHead className="text-right">Holdback (25%)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => {
                  const employee = employeeMap.get(payout.employee_id);
                  return (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee?.full_name || payout.employee_id}</p>
                          <p className="text-xs text-muted-foreground">{payout.employee_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payout.payout_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${payout.calculated_amount_usd.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        ${(payout.paid_amount_usd || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-warning">
                        ${(payout.holdback_amount_usd || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payouts for this period</p>
              <p className="text-sm">Upload a CSV file to add payout records</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload Monthly Payouts"
        description="Upload payout records for the selected month"
        templateColumns={templateColumns}
        templateFilename={`payouts_template_${selectedMonth}.csv`}
        onUpload={handleCsvUpload}
        validateRow={validateRow}
      />
    </div>
  );
}
