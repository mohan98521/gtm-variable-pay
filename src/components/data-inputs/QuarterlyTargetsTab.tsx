import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvUploadDialog } from "./CsvUploadDialog";
import { useQuarterlyTargets, useInsertQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useEmployees } from "@/hooks/useEmployees";

interface QuarterlyTargetsTabProps {
  selectedYear: number;
}

export function QuarterlyTargetsTab({ selectedYear }: QuarterlyTargetsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: targets, isLoading } = useQuarterlyTargets(selectedYear);
  const { data: employees } = useEmployees();
  const insertMutation = useInsertQuarterlyTargets();

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) || []);

  // Group targets by employee
  const groupedTargets = targets?.reduce((acc, target) => {
    const key = target.employee_id;
    if (!acc[key]) {
      acc[key] = { employee_id: key, quarters: {} };
    }
    const qKey = `Q${target.quarter}_${target.metric_type}`;
    acc[key].quarters[qKey] = target.target_value_usd;
    return acc;
  }, {} as Record<string, { employee_id: string; quarters: Record<string, number> }>);

  const handleCsvUpload = async (data: Record<string, string>[]) => {
    const targetsToInsert = data.map((row) => ({
      employee_id: row.employee_id,
      effective_year: selectedYear,
      quarter: parseInt(row.quarter),
      metric_type: row.metric_type,
      target_value_usd: parseFloat(row.target_value_usd) || 0,
    }));

    await insertMutation.mutateAsync(targetsToInsert);
  };

  const validateRow = (row: Record<string, string>, index: number): string | null => {
    if (!row.employee_id) return "Employee ID is required";
    if (!row.quarter || parseInt(row.quarter) < 1 || parseInt(row.quarter) > 4) {
      return "Quarter must be 1, 2, 3, or 4";
    }
    if (!row.metric_type) return "Metric type is required";
    if (!row.target_value_usd || isNaN(parseFloat(row.target_value_usd))) {
      return "Valid target value (USD) is required";
    }
    if (!employeeMap.has(row.employee_id)) {
      return `Employee ID "${row.employee_id}" not found`;
    }
    return null;
  };

  const templateColumns = [
    "employee_id",
    "quarter",
    "metric_type",
    "target_value_usd",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Quarterly Targets</h3>
          <p className="text-sm text-muted-foreground">
            Quarterly breakdown of performance targets for {selectedYear}
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
          ) : groupedTargets && Object.keys(groupedTargets).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Q1 Software ARR</TableHead>
                  <TableHead className="text-right">Q2 Software ARR</TableHead>
                  <TableHead className="text-right">Q3 Software ARR</TableHead>
                  <TableHead className="text-right">Q4 Software ARR</TableHead>
                  <TableHead className="text-right">Annual Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(groupedTargets).map((item) => {
                  const employee = employeeMap.get(item.employee_id);
                  const q1 = item.quarters["Q1_Software ARR"] || 0;
                  const q2 = item.quarters["Q2_Software ARR"] || 0;
                  const q3 = item.quarters["Q3_Software ARR"] || 0;
                  const q4 = item.quarters["Q4_Software ARR"] || 0;
                  const total = q1 + q2 + q3 + q4;

                  return (
                    <TableRow key={item.employee_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee?.full_name || item.employee_id}</p>
                          <p className="text-xs text-muted-foreground">{item.employee_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">${q1.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${q2.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${q3.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${q4.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">${total.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No quarterly targets for {selectedYear}</p>
              <p className="text-sm">Upload a CSV file to add targets</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload Quarterly Targets"
        description={`Upload quarterly performance targets for ${selectedYear}`}
        templateColumns={templateColumns}
        templateFilename={`quarterly_targets_template_${selectedYear}.csv`}
        onUpload={handleCsvUpload}
        validateRow={validateRow}
      />
    </div>
  );
}
