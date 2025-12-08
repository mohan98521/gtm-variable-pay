import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvUploadDialog } from "./CsvUploadDialog";
import { useClosingArrTargets, useInsertClosingArrTargets } from "@/hooks/useClosingArrTargets";
import { useEmployees } from "@/hooks/useEmployees";

interface ClosingArrTabProps {
  selectedYear: number;
}

export function ClosingArrTab({ selectedYear }: ClosingArrTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: targets, isLoading } = useClosingArrTargets(selectedYear);
  const { data: employees } = useEmployees();
  const insertMutation = useInsertClosingArrTargets();

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) || []);

  const handleCsvUpload = async (data: Record<string, string>[]) => {
    const targetsToInsert = data.map((row) => ({
      employee_id: row.employee_id,
      effective_year: selectedYear,
      opening_arr_usd: parseFloat(row.opening_arr_usd) || 0,
      software_bookings_target_usd: parseFloat(row.software_bookings_target_usd) || 0,
      msps_bookings_target_usd: parseFloat(row.msps_bookings_target_usd) || 0,
      software_churn_allowance_usd: parseFloat(row.software_churn_allowance_usd) || 0,
      ms_churn_allowance_usd: parseFloat(row.ms_churn_allowance_usd) || 0,
      net_price_increase_target_usd: parseFloat(row.net_price_increase_target_usd) || 0,
      closing_arr_target_usd: parseFloat(row.closing_arr_target_usd) || 0,
    }));

    await insertMutation.mutateAsync(targetsToInsert);
  };

  const validateRow = (row: Record<string, string>, index: number): string | null => {
    if (!row.employee_id) return "Employee ID is required";
    if (!row.closing_arr_target_usd || isNaN(parseFloat(row.closing_arr_target_usd))) {
      return "Valid closing ARR target (USD) is required";
    }
    if (!employeeMap.has(row.employee_id)) {
      return `Employee ID "${row.employee_id}" not found`;
    }
    return null;
  };

  const templateColumns = [
    "employee_id",
    "opening_arr_usd",
    "software_bookings_target_usd",
    "msps_bookings_target_usd",
    "software_churn_allowance_usd",
    "ms_churn_allowance_usd",
    "net_price_increase_target_usd",
    "closing_arr_target_usd",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Closing ARR Targets</h3>
          <p className="text-sm text-muted-foreground">
            Detailed Closing ARR breakdown for Farmer roles ({selectedYear})
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : targets && targets.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Opening ARR</TableHead>
                    <TableHead className="text-right">Software Bookings</TableHead>
                    <TableHead className="text-right">MS/PS Bookings</TableHead>
                    <TableHead className="text-right">SW Churn Allow.</TableHead>
                    <TableHead className="text-right">MS Churn Allow.</TableHead>
                    <TableHead className="text-right">Net Price Inc.</TableHead>
                    <TableHead className="text-right">Closing ARR Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((target) => {
                    const employee = employeeMap.get(target.employee_id);
                    return (
                      <TableRow key={target.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee?.full_name || target.employee_id}</p>
                            <p className="text-xs text-muted-foreground">{target.employee_id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          ${target.opening_arr_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          +${target.software_bookings_target_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          +${target.msps_bookings_target_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          -${target.software_churn_allowance_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          -${target.ms_churn_allowance_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          +${target.net_price_increase_target_usd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${target.closing_arr_target_usd.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No Closing ARR targets for {selectedYear}</p>
              <p className="text-sm">Upload a CSV file to add targets</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload Closing ARR Targets"
        description={`Upload Closing ARR target breakdown for Farmer roles in ${selectedYear}`}
        templateColumns={templateColumns}
        templateFilename={`closing_arr_targets_template_${selectedYear}.csv`}
        onUpload={handleCsvUpload}
        validateRow={validateRow}
      />
    </div>
  );
}
