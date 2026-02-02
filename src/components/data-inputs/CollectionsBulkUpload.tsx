import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format, parseISO, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Download,
  Check,
  ArrowRight,
  Clock,
} from "lucide-react";
import { usePendingCollections, useBulkImportCollections } from "@/hooks/useCollections";
import { generateCSV, downloadCSV } from "@/lib/csvExport";

interface CollectionsBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  project_id: string;
  is_collected: boolean;
  collection_date: string | null;
  notes: string | null;
  original_row: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CollectionMatch {
  id: string;
  project_id: string;
  customer_name: string | null;
  is_collected: boolean;
  collection_date: string | null;
  notes: string | null;
}

export function CollectionsBulkUpload({ open, onOpenChange }: CollectionsBulkUploadProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [matchedRecords, setMatchedRecords] = useState<CollectionMatch[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: pendingCollections = [] } = usePendingCollections();
  const bulkImportMutation = useBulkImportCollections();

  const resetState = () => {
    setParsedRows([]);
    setErrors([]);
    setMatchedRecords([]);
    setIsValidating(false);
    setFileName(null);
  };

  const normalizeBoolean = (value: unknown): boolean | null => {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).toLowerCase().trim();
    if (["yes", "y", "true", "1"].includes(str)) return true;
    if (["no", "n", "false", "0"].includes(str)) return false;
    return null;
  };

  const normalizeDate = (value: unknown): string | null => {
    if (!value || value === "") return null;
    const str = String(value).trim();
    
    // Try parsing as ISO date
    const parsed = parseISO(str);
    if (isValid(parsed)) {
      return format(parsed, "yyyy-MM-dd");
    }
    
    // Try parsing common formats
    const dateFormats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,   // MM-DD-YYYY
    ];
    
    for (const regex of dateFormats) {
      const match = str.match(regex);
      if (match) {
        const [, m, d, y] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        if (isValid(date)) {
          return format(date, "yyyy-MM-dd");
        }
      }
    }
    
    return null;
  };

  const parseFile = useCallback(async (file: File) => {
    setIsValidating(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        const validationErrors: ValidationError[] = [];
        const parsed: ParsedRow[] = [];
        const matched: CollectionMatch[] = [];
        
        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // Account for header row
          
          // Get project_id (required)
          const projectId = String(row.project_id || row.Project_ID || row["Project ID"] || "").trim();
          if (!projectId) {
            validationErrors.push({
              row: rowNum,
              field: "project_id",
              message: "project_id is required",
            });
            return;
          }
          
          // Check if project exists in pending collections
          const collection = pendingCollections.find(c => c.project_id === projectId);
          if (!collection) {
            validationErrors.push({
              row: rowNum,
              field: "project_id",
              message: `Project "${projectId}" not found in pending collections`,
            });
            return;
          }
          
          // Parse is_collected (required)
          const rawCollected = row.is_collected ?? row.Is_Collected ?? row["Is Collected"] ?? row.Collected ?? "";
          const isCollected = normalizeBoolean(rawCollected);
          if (isCollected === null) {
            validationErrors.push({
              row: rowNum,
              field: "is_collected",
              message: `Invalid value "${rawCollected}". Must be Yes/No`,
            });
            return;
          }
          
          // Parse collection_date (optional, but required if collected)
          const rawDate = row.collection_date ?? row.Collection_Date ?? row["Collection Date"] ?? "";
          let collectionDate: string | null = null;
          if (rawDate) {
            collectionDate = normalizeDate(rawDate);
            if (!collectionDate) {
              validationErrors.push({
                row: rowNum,
                field: "collection_date",
                message: `Invalid date format "${rawDate}"`,
              });
              return;
            }
          } else if (isCollected) {
            // Auto-set to today if collected but no date provided
            collectionDate = format(new Date(), "yyyy-MM-dd");
          }
          
          // Parse notes (optional)
          const notes = String(row.notes ?? row.Notes ?? "").trim() || null;
          
          parsed.push({
            project_id: projectId,
            is_collected: isCollected,
            collection_date: collectionDate,
            notes,
            original_row: rowNum,
          });
          
          matched.push({
            id: collection.id,
            project_id: projectId,
            customer_name: collection.customer_name,
            is_collected: isCollected,
            collection_date: collectionDate,
            notes,
          });
        });
        
        setErrors(validationErrors);
        setParsedRows(parsed);
        setMatchedRecords(matched);
      } catch (error) {
        setErrors([{
          row: 0,
          field: "file",
          message: "Failed to parse file. Please ensure it's a valid CSV or Excel file.",
        }]);
      } finally {
        setIsValidating(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, [pendingCollections]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      resetState();
      parseFile(acceptedFiles[0]);
    }
  }, [parseFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = () => {
    const templateData = pendingCollections.map(c => ({
      project_id: c.project_id,
      customer_name: c.customer_name || "",
      deal_value_usd: c.deal_value_usd || 0,
      booking_month: c.booking_month ? format(parseISO(c.booking_month), "MMM yyyy") : "",
      type_of_proposal: c.deal?.type_of_proposal || "",
      sales_rep_name: c.deal?.sales_rep_name || "",
      is_collected: "No",
      collection_date: "",
      notes: "",
    }));

    const columns = [
      { key: "project_id", header: "project_id" },
      { key: "customer_name", header: "customer_name" },
      { key: "deal_value_usd", header: "deal_value_usd" },
      { key: "booking_month", header: "booking_month" },
      { key: "type_of_proposal", header: "type_of_proposal" },
      { key: "sales_rep_name", header: "sales_rep_name" },
      { key: "is_collected", header: "is_collected" },
      { key: "collection_date", header: "collection_date" },
      { key: "notes", header: "notes" },
    ];

    const csv = generateCSV(templateData, columns as any);
    downloadCSV(csv, `collection-status-template-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const handleDownloadErrors = () => {
    const errorData = errors.map(err => ({
      row: err.row,
      field: err.field,
      message: err.message,
    }));

    const columns = [
      { key: "row", header: "Row" },
      { key: "field", header: "Field" },
      { key: "message", header: "Error Message" },
    ];

    const csv = generateCSV(errorData, columns as any);
    downloadCSV(csv, `collection-upload-errors-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const handleApplyUpdates = async () => {
    if (matchedRecords.length === 0) return;

    const updates = matchedRecords.map(record => ({
      id: record.id,
      is_collected: record.is_collected,
      collection_date: record.collection_date,
      notes: record.notes,
    }));

    await bulkImportMutation.mutateAsync(updates);
    onOpenChange(false);
    resetState();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Collection Status
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to bulk update collection statuses.
            Export the template first, update the is_collected column, then re-import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* File Drop Zone */}
          {!fileName && (
            <>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors
                  ${isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                  }
                `}
              >
                <input {...getInputProps()} />
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? "Drop the file here..."
                    : "Drag & drop your file here, or click to browse"
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: .csv, .xlsx, .xls
                </p>
              </div>

              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1.5" />
                Download Template
              </Button>
            </>
          )}

          {/* File Selected */}
          {fileName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium flex-1">{fileName}</span>
              <Button variant="ghost" size="sm" onClick={resetState}>
                Change
              </Button>
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{errors.length} validation error{errors.length !== 1 ? "s" : ""} found</span>
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Errors
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {errors.length > 0 && (
            <ScrollArea className="max-h-32 border rounded-md">
              <div className="p-3 space-y-1">
                {errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Row {err.row}: {err.field} - {err.message}
                  </p>
                ))}
                {errors.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {errors.length - 10} more errors
                  </p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Preview Table */}
          {matchedRecords.length > 0 && errors.length === 0 && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {matchedRecords.length} record{matchedRecords.length !== 1 ? "s" : ""} to update
                </Badge>
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Collection Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedRecords.slice(0, 20).map((record, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {record.project_id}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.customer_name || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            {record.is_collected ? (
                              <Badge variant="default" className="text-xs bg-success">
                                <Check className="h-3 w-3 mr-1" />
                                Collected
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.collection_date || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {matchedRecords.length > 20 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
                          ... and {matchedRecords.length - 20} more records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyUpdates}
            disabled={matchedRecords.length === 0 || errors.length > 0 || bulkImportMutation.isPending}
          >
            {bulkImportMutation.isPending ? "Applying..." : `Apply ${matchedRecords.length} Updates`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
