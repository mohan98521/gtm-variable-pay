import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { METRIC_TYPES, BUSINESS_UNITS, PARTICIPANT_ROLES, generateDealId } from "@/hooks/useDeals";

interface DealsBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedDeal {
  deal_id: string;
  deal_name: string;
  client_name: string;
  metric_type: string;
  business_unit: string;
  month_year: string;
  deal_value_local: number;
  local_currency: string;
  deal_value_usd: number;
  notes?: string;
  sales_rep_id?: string;
  sales_head_id?: string;
  se_id?: string;
  channel_rep_id?: string;
  product_specialist_id?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const CSV_TEMPLATE_HEADERS = [
  "deal_id",
  "deal_name",
  "client_name",
  "metric_type",
  "business_unit",
  "month_year",
  "deal_value_local",
  "local_currency",
  "deal_value_usd",
  "notes",
  "sales_rep_id",
  "sales_head_id",
  "se_id",
  "channel_rep_id",
  "product_specialist_id",
];

const generateCSVTemplate = (): string => {
  const headers = CSV_TEMPLATE_HEADERS.join(",");
  const exampleRow = [
    "AUTO",
    "Example Deal Name",
    "Example Client",
    "software_arr",
    "banking",
    "2026-01-01",
    "100000",
    "USD",
    "100000",
    "Optional notes",
    "EMP001",
    "EMP002",
    "",
    "",
    "",
  ].join(",");
  
  return `${headers}\n${exampleRow}`;
};

export function DealsBulkUpload({ open, onOpenChange }: DealsBulkUploadProps) {
  const [parsedDeals, setParsedDeals] = useState<ParsedDeal[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { selectedYear, isMonthInFiscalYear } = useFiscalYear();

  // Fetch employees for validation
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list-validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const validMetricTypes = METRIC_TYPES.map((m) => m.value);
  const validBusinessUnits = BUSINESS_UNITS.map((b) => b.value);

  const parseCSV = (text: string): ParsedDeal[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const deals: ParsedDeal[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const deal: Record<string, string> = {};

      headers.forEach((header, index) => {
        deal[header] = values[index] || "";
      });

      deals.push({
        deal_id: deal.deal_id === "AUTO" ? generateDealId(deal.metric_type || "software_arr") : deal.deal_id,
        deal_name: deal.deal_name,
        client_name: deal.client_name,
        metric_type: deal.metric_type,
        business_unit: deal.business_unit,
        month_year: deal.month_year,
        deal_value_local: parseFloat(deal.deal_value_local) || 0,
        local_currency: deal.local_currency || "USD",
        deal_value_usd: parseFloat(deal.deal_value_usd) || 0,
        notes: deal.notes || undefined,
        sales_rep_id: deal.sales_rep_id || undefined,
        sales_head_id: deal.sales_head_id || undefined,
        se_id: deal.se_id || undefined,
        channel_rep_id: deal.channel_rep_id || undefined,
        product_specialist_id: deal.product_specialist_id || undefined,
      });
    }

    return deals;
  };

  const validateDeals = (deals: ParsedDeal[]): ValidationError[] => {
    const errors: ValidationError[] = [];
    const employeeIds = new Set(employees.map((e) => e.employee_id));

    deals.forEach((deal, index) => {
      const row = index + 2; // Account for header row and 0-indexing

      if (!deal.deal_name) {
        errors.push({ row, field: "deal_name", message: "Deal name is required" });
      }

      if (!deal.client_name) {
        errors.push({ row, field: "client_name", message: "Client name is required" });
      }

      if (!validMetricTypes.includes(deal.metric_type as typeof validMetricTypes[number])) {
        errors.push({
          row,
          field: "metric_type",
          message: `Invalid metric type. Must be one of: ${validMetricTypes.join(", ")}`,
        });
      }

      if (!validBusinessUnits.includes(deal.business_unit as typeof validBusinessUnits[number])) {
        errors.push({
          row,
          field: "business_unit",
          message: `Invalid business unit. Must be one of: ${validBusinessUnits.join(", ")}`,
        });
      }

      if (!deal.month_year || !deal.month_year.match(/^\d{4}-\d{2}-\d{2}$/)) {
        errors.push({ row, field: "month_year", message: "Invalid date format. Use YYYY-MM-DD" });
      } else if (!isMonthInFiscalYear(deal.month_year)) {
        errors.push({
          row,
          field: "month_year",
          message: `Month must be within fiscal year ${selectedYear}`,
        });
      }

      if (deal.deal_value_usd <= 0) {
        errors.push({ row, field: "deal_value_usd", message: "Deal value USD must be greater than 0" });
      }

      // Validate participant employee IDs if provided
      const participantFields = ["sales_rep_id", "sales_head_id", "se_id", "channel_rep_id", "product_specialist_id"];
      participantFields.forEach((field) => {
        const empId = deal[field as keyof ParsedDeal] as string | undefined;
        if (empId && !employeeIds.has(empId)) {
          errors.push({ row, field, message: `Employee ID "${empId}" not found` });
        }
      });
    });

    return errors;
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const deals = parseCSV(text);
        const errors = validateDeals(deals);

        setParsedDeals(deals);
        setValidationErrors(errors);
      };
      reader.readAsText(file);
    },
    [employees, selectedYear, isMonthInFiscalYear]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const uploadMutation = useMutation({
    mutationFn: async (deals: ParsedDeal[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];

        // Insert deal
        const { data: createdDeal, error: dealError } = await supabase
          .from("deals")
          .insert({
            deal_id: deal.deal_id,
            deal_name: deal.deal_name,
            client_name: deal.client_name,
            metric_type: deal.metric_type,
            business_unit: deal.business_unit,
            month_year: deal.month_year,
            deal_value_local: deal.deal_value_local,
            local_currency: deal.local_currency,
            deal_value_usd: deal.deal_value_usd,
            notes: deal.notes,
            status: "draft",
          })
          .select()
          .single();

        if (dealError) throw dealError;

        // Build participants array
        const participants: { deal_id: string; employee_id: string; participant_role: string; split_percent: number }[] = [];

        const participantMapping: { field: keyof ParsedDeal; role: string }[] = [
          { field: "sales_rep_id", role: "sales_rep" },
          { field: "sales_head_id", role: "sales_head" },
          { field: "se_id", role: "se" },
          { field: "channel_rep_id", role: "channel_rep" },
          { field: "product_specialist_id", role: "product_specialist" },
        ];

        for (const { field, role } of participantMapping) {
          const empId = deal[field] as string | undefined;
          if (empId) {
            const employee = employees.find((e) => e.employee_id === empId);
            if (employee) {
              participants.push({
                deal_id: createdDeal.id,
                employee_id: employee.employee_id,
                participant_role: role,
                split_percent: 100,
              });
            }
          }
        }

        if (participants.length > 0) {
          const { error: participantError } = await supabase
            .from("deal_participants")
            .insert(participants);

          if (participantError) throw participantError;
        }

        setUploadProgress(Math.round(((i + 1) / deals.length) * 100));
      }

      return deals.length;
    },
    onSuccess: (count) => {
      toast.success(`Successfully uploaded ${count} deals`);
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setParsedDeals([]);
      setValidationErrors([]);
      setIsUploading(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals_upload_template_FY${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    if (validationErrors.length > 0) {
      toast.error("Please fix validation errors before uploading");
      return;
    }
    uploadMutation.mutate(parsedDeals);
  };

  const handleClose = () => {
    setParsedDeals([]);
    setValidationErrors([]);
    setUploadProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Deals</DialogTitle>
          <DialogDescription>
            Upload multiple deals for FY {selectedYear} using a CSV file. Download the template first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Download Template */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">CSV Template</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
          </div>

          {/* Fiscal Year Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              All deals must have a month_year within FY {selectedYear} (Jan-Dec {selectedYear}).
            </AlertDescription>
          </Alert>

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-primary">Drop the CSV file here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium">Drag & drop a CSV file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to select a file</p>
              </div>
            )}
          </div>

          {/* Parsed Results */}
          {parsedDeals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {parsedDeals.length} deals parsed
                </span>
                {validationErrors.length === 0 ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {validationErrors.length} errors
                  </Badge>
                )}
              </div>

              {validationErrors.length > 0 && (
                <ScrollArea className="h-32 border rounded-md p-3">
                  <div className="space-y-1">
                    {validationErrors.map((error, idx) => (
                      <div key={idx} className="text-xs text-destructive">
                        Row {error.row}, {error.field}: {error.message}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading deals...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={parsedDeals.length === 0 || validationErrors.length > 0 || isUploading}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Upload {parsedDeals.length} Deals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
