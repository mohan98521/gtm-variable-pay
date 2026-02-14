import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBulkCreatePerformanceTargets, QuarterlyTargetInput } from "@/hooks/usePerformanceTargets";
import { toast } from "@/hooks/use-toast";
import { generateCSV, downloadCSV } from "@/lib/csvExport";

interface PerformanceTargetsBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  employee_id: string;
  metric_type: string;
  q1_target_usd: number;
  q2_target_usd: number;
  q3_target_usd: number;
  q4_target_usd: number;
  annual_target_usd: number;
  isValid: boolean;
  errors: string[];
}

export function PerformanceTargetsBulkUpload({
  open,
  onOpenChange,
}: PerformanceTargetsBulkUploadProps) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const bulkCreateMutation = useBulkCreatePerformanceTargets();

  // Fetch employees for validation
  const { data: employees } = useQuery({
    queryKey: ["employees_for_validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id, full_name");

      if (error) throw error;
      return new Map(data?.map((e) => [e.employee_id, e.full_name]) || []);
    },
  });

  const downloadTemplate = () => {
    const template = `employee_id,metric_type,q1_target_usd,q2_target_usd,q3_target_usd,q4_target_usd
EMP001,New Software Booking ARR,200000,250000,250000,300000
EMP001,CR/ER,50000,60000,60000,80000
EMP001,Implementation,25000,30000,30000,40000
EMP002,Closing ARR,100000,125000,125000,150000`;

    downloadCSV(template, "performance_targets_template.csv");
  };

  const parseCSV = (content: string): ParsedRow[] => {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const errors: string[] = [];

      const employee_id = values[headers.indexOf("employee_id")] || "";
      const metric_type = values[headers.indexOf("metric_type")] || "";
      const q1 = parseFloat(values[headers.indexOf("q1_target_usd")]) || 0;
      const q2 = parseFloat(values[headers.indexOf("q2_target_usd")]) || 0;
      const q3 = parseFloat(values[headers.indexOf("q3_target_usd")]) || 0;
      const q4 = parseFloat(values[headers.indexOf("q4_target_usd")]) || 0;
      const annual = q1 + q2 + q3 + q4;

      // Validation
      if (!employee_id) {
        errors.push("Missing employee_id");
      } else if (employees && !employees.has(employee_id)) {
        errors.push(`Employee "${employee_id}" not found`);
      }

      if (!metric_type) {
        errors.push("Missing metric_type");
      }

      if (q1 < 0 || q2 < 0 || q3 < 0 || q4 < 0) {
        errors.push("Negative values not allowed");
      }

      if (q1 === 0 && q2 === 0 && q3 === 0 && q4 === 0) {
        errors.push("At least one quarter must have value > 0");
      }

      rows.push({
        employee_id,
        metric_type,
        q1_target_usd: q1,
        q2_target_usd: q2,
        q3_target_usd: q3,
        q4_target_usd: q4,
        annual_target_usd: annual,
        isValid: errors.length === 0,
        errors,
      });
    }

    return rows;
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsed = parseCSV(content);
        setParsedData(parsed);
        setUploadComplete(false);
        setUploadResult(null);
      };
      reader.readAsText(file);
    },
    [employees]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    const validRows = parsedData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast({
        title: "No Valid Rows",
        description: "Please fix validation errors before uploading.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const inputs: QuarterlyTargetInput[] = validRows.map((row) => ({
        employee_id: row.employee_id,
        metric_type: row.metric_type,
        q1: row.q1_target_usd,
        q2: row.q2_target_usd,
        q3: row.q3_target_usd,
        q4: row.q4_target_usd,
      }));

      const result = await bulkCreateMutation.mutateAsync(inputs);
      setUploadResult(result);
      setUploadComplete(true);

      toast({
        title: "Upload Complete",
        description: `Created ${result.created}, Updated ${result.updated} targets.`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setUploadComplete(false);
    setUploadResult(null);
    onOpenChange(false);
  };

  const validCount = parsedData.filter((r) => r.isValid).length;
  const invalidCount = parsedData.filter((r) => !r.isValid).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Performance Targets</DialogTitle>
          <DialogDescription>
            Upload a CSV file with quarterly targets. Annual targets will be calculated automatically.
            Supports CR/ER and Implementation metrics for NRR target computation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">CSV Template</p>
                <p className="text-sm text-muted-foreground">
                  Download the template with required columns
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Dropzone */}
          {!uploadComplete && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-primary">Drop the CSV file here...</p>
              ) : (
                <>
                  <p className="font-medium">Drag & drop a CSV file here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to select a file
                  </p>
                </>
              )}
            </div>
          )}

          {/* Parsed Data Preview */}
          {parsedData.length > 0 && !uploadComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-success/10 text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <>
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {invalidCount} invalid
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const invalidRows = parsedData.filter((r) => !r.isValid);
                        const csv = generateCSV(invalidRows, [
                          { key: "employee_id", header: "Employee ID" },
                          { key: "metric_type", header: "Metric Type" },
                          { key: "errors", header: "Errors", getValue: (row) => row.errors.join("; ") },
                        ]);
                        downloadCSV(csv, `performance_targets_upload_errors_${new Date().toISOString().split("T")[0]}.csv`);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Errors
                    </Button>
                  </>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Metric Type</TableHead>
                      <TableHead className="text-right">Q1</TableHead>
                      <TableHead className="text-right">Q2</TableHead>
                      <TableHead className="text-right">Q3</TableHead>
                      <TableHead className="text-right">Q4</TableHead>
                      <TableHead className="text-right">Annual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={!row.isValid ? "bg-destructive/5" : ""}
                      >
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-destructive" />
                              <span className="text-xs text-destructive">
                                {row.errors.join(", ")}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.employee_id}
                        </TableCell>
                        <TableCell>{row.metric_type}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.q1_target_usd)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.q2_target_usd)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.q3_target_usd)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.q4_target_usd)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.annual_target_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    Showing 10 of {parsedData.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </div>
              <Progress value={50} />
            </div>
          )}

          {/* Upload Complete */}
          {uploadComplete && uploadResult && (
            <div className="rounded-lg border bg-success/5 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload Complete!</h3>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div>
                  <span className="font-semibold text-success">{uploadResult.created}</span>{" "}
                  created
                </div>
                <div>
                  <span className="font-semibold text-primary">{uploadResult.updated}</span>{" "}
                  updated
                </div>
                {uploadResult.errors.length > 0 && (
                  <div>
                    <span className="font-semibold text-destructive">
                      {uploadResult.errors.length}
                    </span>{" "}
                    errors
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {uploadComplete ? "Close" : "Cancel"}
          </Button>
          {!uploadComplete && parsedData.length > 0 && (
            <Button
              onClick={handleUpload}
              disabled={isProcessing || validCount === 0}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload {validCount} Target{validCount !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
