import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CsvUploadDialog } from "./CsvUploadDialog";
import { usePerformanceTargets, useInsertPerformanceTargets, QUARTERLY_SPLIT_PERCENTAGES } from "@/hooks/usePerformanceTargets";
import { useEmployees } from "@/hooks/useEmployees";

interface QuarterlyTargetsTabProps {
  selectedYear: number;
}

export function QuarterlyTargetsTab({ selectedYear }: QuarterlyTargetsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: targets, isLoading } = usePerformanceTargets(selectedYear);
  const { data: employees } = useEmployees();
  const insertMutation = useInsertPerformanceTargets();

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) || []);

  // Group targets by employee and metric type
  const groupedTargets = targets?.reduce((acc, target) => {
    const key = target.employee_id;
    if (!acc[key]) {
      acc[key] = { 
        employee_id: key, 
        software_arr: 0, 
        msps_arr: 0 
      };
    }
    if (target.metric_type === "New Software Booking ARR") {
      acc[key].software_arr = target.target_value_usd;
    } else if (target.metric_type === "MS/PS ARR") {
      acc[key].msps_arr = target.target_value_usd;
    }
    return acc;
  }, {} as Record<string, { employee_id: string; software_arr: number; msps_arr: number }>);

  const handleCsvUpload = async (data: Record<string, string>[]) => {
    const targetsToInsert = data.flatMap((row) => {
      const results: { employee_id: string; effective_year: number; metric_type: string; target_value_usd: number }[] = [];
      
      if (row.software_arr_target_usd) {
        results.push({
          employee_id: row.employee_id,
          effective_year: selectedYear,
          metric_type: "New Software Booking ARR",
          target_value_usd: parseFloat(row.software_arr_target_usd) || 0,
        });
      }
      
      if (row.msps_arr_target_usd) {
        results.push({
          employee_id: row.employee_id,
          effective_year: selectedYear,
          metric_type: "MS/PS ARR",
          target_value_usd: parseFloat(row.msps_arr_target_usd) || 0,
        });
      }
      
      return results;
    });

    await insertMutation.mutateAsync(targetsToInsert);
  };

  const validateRow = (row: Record<string, string>, index: number): string | null => {
    if (!row.employee_id) return "Employee ID is required";
    if (!row.software_arr_target_usd && !row.msps_arr_target_usd) {
      return "At least one target value is required";
    }
    if (row.software_arr_target_usd && isNaN(parseFloat(row.software_arr_target_usd))) {
      return "Software ARR target must be a valid number";
    }
    if (row.msps_arr_target_usd && isNaN(parseFloat(row.msps_arr_target_usd))) {
      return "MS/PS ARR target must be a valid number";
    }
    if (!employeeMap.has(row.employee_id)) {
      return `Employee ID "${row.employee_id}" not found`;
    }
    return null;
  };

  const templateColumns = [
    "employee_id",
    "software_arr_target_usd",
    "msps_arr_target_usd",
  ];

  // Calculate quarterly split from annual target
  const calcQuarterly = (annual: number, quarter: 1 | 2 | 3 | 4) => {
    const percentages = [0.20, 0.25, 0.25, 0.30];
    return annual * percentages[quarter - 1];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-medium">New Bookings Targets</h3>
            <p className="text-sm text-muted-foreground">
              Annual targets with quarterly split (20% / 25% / 25% / 30%) for {selectedYear}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Quarterly targets are automatically calculated from annual targets:</p>
                <ul className="text-xs mt-1 space-y-0.5">
                  <li>Q1: 20% of annual target</li>
                  <li>Q2: 25% of annual target</li>
                  <li>Q3: 25% of annual target</li>
                  <li>Q4: 30% of annual target</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Annual Targets
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : groupedTargets && Object.keys(groupedTargets).length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="align-middle">Employee</TableHead>
                    <TableHead colSpan={5} className="text-center border-l">Software ARR ($K)</TableHead>
                    <TableHead colSpan={5} className="text-center border-l">MS/PS ARR ($K)</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-right border-l text-xs">Annual</TableHead>
                    <TableHead className="text-right text-xs">Q1 (20%)</TableHead>
                    <TableHead className="text-right text-xs">Q2 (25%)</TableHead>
                    <TableHead className="text-right text-xs">Q3 (25%)</TableHead>
                    <TableHead className="text-right text-xs">Q4 (30%)</TableHead>
                    <TableHead className="text-right border-l text-xs">Annual</TableHead>
                    <TableHead className="text-right text-xs">Q1 (20%)</TableHead>
                    <TableHead className="text-right text-xs">Q2 (25%)</TableHead>
                    <TableHead className="text-right text-xs">Q3 (25%)</TableHead>
                    <TableHead className="text-right text-xs">Q4 (30%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(groupedTargets).map((item) => {
                    const employee = employeeMap.get(item.employee_id);
                    const softwareArr = item.software_arr;
                    const mspsArr = item.msps_arr;

                    return (
                      <TableRow key={item.employee_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee?.full_name || item.employee_id}</p>
                            <p className="text-xs text-muted-foreground">{item.employee_id}</p>
                          </div>
                        </TableCell>
                        {/* Software ARR */}
                        <TableCell className="text-right border-l font-medium">
                          {(softwareArr / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(softwareArr, 1) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(softwareArr, 2) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(softwareArr, 3) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(softwareArr, 4) / 1000).toFixed(0)}
                        </TableCell>
                        {/* MS/PS ARR */}
                        <TableCell className="text-right border-l font-medium">
                          {(mspsArr / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(mspsArr, 1) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(mspsArr, 2) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(mspsArr, 3) / 1000).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(calcQuarterly(mspsArr, 4) / 1000).toFixed(0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No annual targets for {selectedYear}</p>
              <p className="text-sm">Upload a CSV file with annual Software ARR and MS/PS ARR targets</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload Annual Bookings Targets"
        description={`Upload annual Software ARR and MS/PS ARR targets for ${selectedYear}. Quarterly splits will be calculated automatically (20% / 25% / 25% / 30%).`}
        templateColumns={templateColumns}
        templateFilename={`annual_bookings_targets_${selectedYear}.csv`}
        onUpload={handleCsvUpload}
        validateRow={validateRow}
      />
    </div>
  );
}
