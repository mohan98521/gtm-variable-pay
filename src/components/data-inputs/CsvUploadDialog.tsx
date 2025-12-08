import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateColumns: string[];
  templateFilename: string;
  onUpload: (data: Record<string, string>[]) => Promise<void>;
  validateRow?: (row: Record<string, string>, index: number) => string | null;
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  templateColumns,
  templateFilename,
  onUpload,
  validateRow,
}: CsvUploadDialogProps) {
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csvContent = templateColumns.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    return rows;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      setParsedData(data);

      // Validate rows
      const validationErrors: string[] = [];
      if (validateRow) {
        data.forEach((row, index) => {
          const error = validateRow(row, index);
          if (error) {
            validationErrors.push(`Row ${index + 2}: ${error}`);
          }
        });
      }
      setErrors(validationErrors);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0 || errors.length > 0) return;

    setIsUploading(true);
    try {
      await onUpload(parsedData);
      setParsedData([]);
      setFileName(null);
      setErrors([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const resetDialog = () => {
    setParsedData([]);
    setFileName(null);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetDialog();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Download Template</p>
                <p className="text-xs text-muted-foreground">
                  Get the CSV template with required columns
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" />
              Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            {fileName ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={resetDialog}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {parsedData.length} rows parsed
                  </Badge>
                  {errors.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.length} errors
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <label
                htmlFor="csv-upload"
                className="cursor-pointer space-y-2 block"
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV files only</p>
              </label>
            )}
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <ScrollArea className="h-32 border rounded-lg p-3">
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <p key={index} className="text-sm text-destructive">
                    {error}
                  </p>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Preview */}
          {parsedData.length > 0 && errors.length === 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 text-sm font-medium">
                Preview (first 5 rows)
              </div>
              <ScrollArea className="h-40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {Object.keys(parsedData[0]).map((key) => (
                        <th key={key} className="px-2 py-1 text-left font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="px-2 py-1 truncate max-w-[100px]">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={parsedData.length === 0 || errors.length > 0 || isUploading}
            >
              {isUploading ? "Uploading..." : `Upload ${parsedData.length} Records`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
