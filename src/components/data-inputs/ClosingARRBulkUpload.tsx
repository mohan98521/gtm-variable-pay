import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { useBulkUpsertClosingARR, ClosingARRInsert, ORDER_CATEGORY_2_OPTIONS } from "@/hooks/useClosingARR";
import { useProfiles } from "@/hooks/useProfiles";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

interface ClosingARRBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  rowNumber: number;
  data: ClosingARRInsert | null;
  errors: string[];
  raw: Record<string, string>;
}

const CSV_HEADERS = [
  "month_year",
  "bu",
  "product",
  "pid",
  "customer_code",
  "customer_name",
  "order_category",
  "status",
  "order_category_2",
  "opening_arr",
  "cr",
  "als_others",
  "new",
  "inflation",
  "discount_decrement",
  "churn",
  "adjustment",
  "country",
  "revised_region",
  "start_date",
  "end_date",
  "renewal_status",
  "sales_rep_id",
  "sales_head_id",
];

export function ClosingARRBulkUpload({ open, onOpenChange }: ClosingARRBulkUploadProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const { selectedYear } = useFiscalYear();
  const { data: employees = [] } = useProfiles();
  const bulkUpsertMutation = useBulkUpsertClosingARR();

  const validEmployeeIds = new Set(employees.filter(e => e.employee_id).map((e) => e.employee_id));
  const validCategories = new Set<string>(ORDER_CATEGORY_2_OPTIONS.map((o) => o.value));

  const parseNumber = (value: string): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = parseFloat(value.replace(/,/g, ""));
    return isNaN(parsed) ? null : parsed;
  };

  const parseDate = (value: string): string | null => {
    if (!value || value.trim() === "") return null;
    // Try parsing various date formats
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  };

  const validateRow = (row: Record<string, string>, rowNumber: number): ParsedRow => {
    const errors: string[] = [];

    // Required fields
    if (!row.month_year) errors.push("month_year is required");
    if (!row.bu) errors.push("bu is required");
    if (!row.product) errors.push("product is required");
    if (!row.pid) errors.push("pid is required");
    if (!row.customer_code) errors.push("customer_code is required");
    if (!row.customer_name) errors.push("customer_name is required");

    // Validate month_year format and fiscal year
    let monthYear: string | null = null;
    if (row.month_year) {
      monthYear = parseDate(row.month_year);
      if (!monthYear) {
        errors.push("Invalid month_year format");
      } else {
        const year = new Date(monthYear).getFullYear();
        if (year !== selectedYear) {
          errors.push(`month_year must be in fiscal year ${selectedYear}`);
        }
        // Ensure it's the first of the month
        const date = new Date(monthYear);
        monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
      }
    }

    // Validate order_category_2
    if (row.order_category_2 && !validCategories.has(row.order_category_2.toLowerCase())) {
      errors.push("order_category_2 must be 'software' or 'managed_service'");
    }

    // Validate employee IDs
    if (row.sales_rep_id && !validEmployeeIds.has(row.sales_rep_id)) {
      errors.push(`Invalid sales_rep_id: ${row.sales_rep_id}`);
    }
    if (row.sales_head_id && !validEmployeeIds.has(row.sales_head_id)) {
      errors.push(`Invalid sales_head_id: ${row.sales_head_id}`);
    }

    // Find employee names
    const salesRep = employees.find((e) => e.employee_id === row.sales_rep_id);
    const salesHead = employees.find((e) => e.employee_id === row.sales_head_id);

    if (errors.length > 0) {
      return { rowNumber, data: null, errors, raw: row };
    }

    const data: ClosingARRInsert = {
      month_year: monthYear!,
      bu: row.bu,
      product: row.product,
      pid: row.pid,
      customer_code: row.customer_code,
      customer_name: row.customer_name,
      order_category: row.order_category || null,
      status: row.status || null,
      order_category_2: row.order_category_2?.toLowerCase() || null,
      opening_arr: parseNumber(row.opening_arr) || 0,
      cr: parseNumber(row.cr) || 0,
      als_others: parseNumber(row.als_others) || 0,
      new: parseNumber(row.new) || 0,
      inflation: parseNumber(row.inflation) || 0,
      discount_decrement: parseNumber(row.discount_decrement) || 0,
      churn: parseNumber(row.churn) || 0,
      adjustment: parseNumber(row.adjustment) || 0,
      country: row.country || null,
      revised_region: row.revised_region || null,
      start_date: parseDate(row.start_date),
      end_date: parseDate(row.end_date),
      renewal_status: row.renewal_status || null,
      sales_rep_employee_id: row.sales_rep_id || null,
      sales_rep_name: salesRep?.full_name || null,
      sales_head_employee_id: row.sales_head_id || null,
      sales_head_name: salesHead?.full_name || null,
    };

    return { rowNumber, data, errors: [], raw: row };
  };

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const results: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });

      results.push(validateRow(row, i + 1));
    }

    return results;
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        setParsedRows(parsed);
        setUploadComplete(false);
      };
      reader.readAsText(file);
    },
    [employees, selectedYear]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  const validRows = parsedRows.filter((r) => r.data !== null);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleUpload = async () => {
    if (validRows.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const records = validRows.map((r) => r.data!);
      await bulkUpsertMutation.mutateAsync(records);
      setUploadProgress(100);
      setUploadComplete(true);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = CSV_HEADERS.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "closing_arr_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setParsedRows([]);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadComplete(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Closing ARR Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file with monthly Closing ARR data. Existing records with the same PID and
            month will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
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
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-primary">Drop the CSV file here...</p>
              ) : (
                <>
                  <p className="text-foreground">Drag and drop a CSV file here, or click to select</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only .csv files are accepted
                  </p>
                </>
              )}
            </div>
          )}

          {/* Validation Summary */}
          {parsedRows.length > 0 && !uploadComplete && (
            <div className="flex items-center gap-4">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validRows.length} valid rows
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorRows.length} errors
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Total: {parsedRows.length} rows
              </span>
            </div>
          )}

          {/* Error Details */}
          {errorRows.length > 0 && !uploadComplete && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ScrollArea className="max-h-32">
                  <ul className="list-disc list-inside space-y-1">
                    {errorRows.slice(0, 10).map((row) => (
                      <li key={row.rowNumber} className="text-sm">
                        Row {row.rowNumber}: {row.errors.join(", ")}
                      </li>
                    ))}
                    {errorRows.length > 10 && (
                      <li className="text-sm">...and {errorRows.length - 10} more errors</li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {validRows.length > 0 && !uploadComplete && (
            <div>
              <h4 className="text-sm font-medium mb-2">Preview (first 5 rows)</h4>
              <ScrollArea className="max-h-48 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>BU</TableHead>
                      <TableHead>Opening ARR</TableHead>
                      <TableHead>Closing ARR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 5).map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.data?.pid}</TableCell>
                        <TableCell>{row.data?.customer_name}</TableCell>
                        <TableCell>{row.data?.bu}</TableCell>
                        <TableCell>${row.data?.opening_arr?.toLocaleString() || 0}</TableCell>
                        <TableCell>
                          $
                          {(
                            (row.data?.opening_arr || 0) +
                            (row.data?.cr || 0) +
                            (row.data?.als_others || 0) +
                            (row.data?.new || 0) +
                            (row.data?.inflation || 0) -
                            (row.data?.discount_decrement || 0) -
                            (row.data?.churn || 0) +
                            (row.data?.adjustment || 0)
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">Uploading...</p>
            </div>
          )}

          {/* Success */}
          {uploadComplete && (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Successfully uploaded {validRows.length} records. Existing records were updated.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {uploadComplete ? "Close" : "Cancel"}
            </Button>
            {!uploadComplete && (
              <Button
                onClick={handleUpload}
                disabled={validRows.length === 0 || isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload {validRows.length} Records
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
