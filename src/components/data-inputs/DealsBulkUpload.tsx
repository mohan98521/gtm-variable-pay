import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import { PROPOSAL_TYPES, generateProjectId } from "@/hooks/useDeals";

interface DealsBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedDeal {
  project_id: string;
  customer_code: string;
  customer_name?: string;
  region: string;
  country: string;
  bu: string;
  product: string;
  type_of_proposal: string;
  gp_margin_percent?: number;
  month_year: string;
  first_year_amc_usd?: number;
  first_year_subscription_usd?: number;
  managed_services_usd?: number;
  implementation_usd?: number;
  cr_usd?: number;
  er_usd?: number;
  tcv_usd?: number;
  sales_rep_id?: string;
  sales_head_id?: string;
  sales_engineering_id?: string;
  sales_engineering_head_id?: string;
  product_specialist_id?: string;
  product_specialist_head_id?: string;
  solution_manager_id?: string;
  solution_manager_head_id?: string;
  linked_to_impl?: boolean;
  eligible_for_perpetual_incentive?: boolean;
  status?: string;
  notes?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const CSV_TEMPLATE_HEADERS = [
  "project_id",
  "customer_code",
  "customer_name",
  "region",
  "country",
  "bu",
  "product",
  "type_of_proposal",
  "gp_margin_percent",
  "month_year",
  "first_year_amc_usd",
  "first_year_subscription_usd",
  "managed_services_usd",
  "implementation_usd",
  "cr_usd",
  "er_usd",
  "tcv_usd",
  "sales_rep_id",
  "sales_head_id",
  "sales_engineering_id",
  "sales_engineering_head_id",
  "product_specialist_id",
  "product_specialist_head_id",
  "solution_manager_id",
  "solution_manager_head_id",
  "linked_to_impl",
  "eligible_for_perpetual_incentive",
  "status",
  "notes",
];

// Parse MMM-YYYY (e.g., "Jan-2026") or YYYY-MM-DD format to YYYY-MM-DD
const parseMonthYear = (value: string): string | null => {
  if (!value || value.trim() === "") return null;
  
  const trimmed = value.trim();
  
  // Format 1: YYYY-MM-DD (existing format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Format 2: MMM-YYYY (e.g., "Jan-2026")
  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const match = trimmed.match(/^([a-zA-Z]{3})-(\d{4})$/);
  if (match) {
    const monthNum = monthMap[match[1].toLowerCase()];
    if (monthNum) {
      return `${match[2]}-${monthNum}-01`;
    }
  }
  
  return null; // Invalid format
};

const generateCSVTemplate = (): string => {
  const headers = CSV_TEMPLATE_HEADERS.join(",");
  const exampleRow = [
    "AUTO",
    "CUST001",
    "Acme Bank Ltd",
    "APAC",
    "Singapore",
    "banking",
    "Core Banking",
    "amc",
    "25",
    "Jan-2026",
    "100000",
    "50000",
    "25000",
    "30000",
    "0",
    "0",
    "250000",
    "EMP001",
    "EMP002",
    "",
    "",
    "",
    "",
    "",
    "",
    "no",
    "no",
    "draft",
    "Optional notes",
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

  const validProposalTypes = PROPOSAL_TYPES.map((m) => m.value);

  const parseBoolean = (value: string): boolean => {
    const lowered = value.toLowerCase().trim();
    return ["yes", "y", "true", "1"].includes(lowered);
  };

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
        project_id: deal.project_id === "AUTO" ? generateProjectId() : deal.project_id,
        customer_code: deal.customer_code,
        customer_name: deal.customer_name || undefined,
        region: deal.region,
        country: deal.country,
        bu: deal.bu,
        product: deal.product,
        type_of_proposal: deal.type_of_proposal,
        gp_margin_percent: deal.gp_margin_percent ? parseFloat(deal.gp_margin_percent) : undefined,
        month_year: parseMonthYear(deal.month_year) || deal.month_year,
        first_year_amc_usd: deal.first_year_amc_usd ? parseFloat(deal.first_year_amc_usd) : undefined,
        first_year_subscription_usd: deal.first_year_subscription_usd ? parseFloat(deal.first_year_subscription_usd) : undefined,
        managed_services_usd: deal.managed_services_usd ? parseFloat(deal.managed_services_usd) : undefined,
        implementation_usd: deal.implementation_usd ? parseFloat(deal.implementation_usd) : undefined,
        cr_usd: deal.cr_usd ? parseFloat(deal.cr_usd) : undefined,
        er_usd: deal.er_usd ? parseFloat(deal.er_usd) : undefined,
        tcv_usd: deal.tcv_usd ? parseFloat(deal.tcv_usd) : undefined,
        sales_rep_id: deal.sales_rep_id || undefined,
        sales_head_id: deal.sales_head_id || undefined,
        sales_engineering_id: deal.sales_engineering_id || undefined,
        sales_engineering_head_id: deal.sales_engineering_head_id || undefined,
        product_specialist_id: deal.product_specialist_id || undefined,
        product_specialist_head_id: deal.product_specialist_head_id || undefined,
        solution_manager_id: deal.solution_manager_id || undefined,
        solution_manager_head_id: deal.solution_manager_head_id || undefined,
        linked_to_impl: deal.linked_to_impl ? parseBoolean(deal.linked_to_impl) : false,
        eligible_for_perpetual_incentive: deal.eligible_for_perpetual_incentive ? parseBoolean(deal.eligible_for_perpetual_incentive) : false,
        status: deal.status || "draft",
        notes: deal.notes || undefined,
      });
    }

    return deals;
  };

  const parseExcel = (buffer: ArrayBuffer): Record<string, string>[] => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      raw: false,
      defval: "",
    });

    // Normalize headers to lowercase with underscores
    return rows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, "_");
        normalized[normalizedKey] = String(value || "").trim();
      }
      return normalized;
    });
  };

  const rowsToParsedDeals = (rows: Record<string, string>[]): ParsedDeal[] => {
    return rows.map((deal) => ({
      project_id: deal.project_id === "AUTO" ? generateProjectId() : deal.project_id,
      customer_code: deal.customer_code,
      customer_name: deal.customer_name || undefined,
      region: deal.region,
      country: deal.country,
      bu: deal.bu,
      product: deal.product,
      type_of_proposal: deal.type_of_proposal?.toLowerCase().trim() || "",
      gp_margin_percent: deal.gp_margin_percent ? parseFloat(deal.gp_margin_percent) : undefined,
      month_year: parseMonthYear(deal.month_year) || deal.month_year,
      first_year_amc_usd: deal.first_year_amc_usd ? parseFloat(deal.first_year_amc_usd) : undefined,
      first_year_subscription_usd: deal.first_year_subscription_usd ? parseFloat(deal.first_year_subscription_usd) : undefined,
      managed_services_usd: deal.managed_services_usd ? parseFloat(deal.managed_services_usd) : undefined,
      implementation_usd: deal.implementation_usd ? parseFloat(deal.implementation_usd) : undefined,
      cr_usd: deal.cr_usd ? parseFloat(deal.cr_usd) : undefined,
      er_usd: deal.er_usd ? parseFloat(deal.er_usd) : undefined,
      tcv_usd: deal.tcv_usd ? parseFloat(deal.tcv_usd) : undefined,
      sales_rep_id: deal.sales_rep_id || undefined,
      sales_head_id: deal.sales_head_id || undefined,
      sales_engineering_id: deal.sales_engineering_id || undefined,
      sales_engineering_head_id: deal.sales_engineering_head_id || undefined,
      product_specialist_id: deal.product_specialist_id || undefined,
      product_specialist_head_id: deal.product_specialist_head_id || undefined,
      solution_manager_id: deal.solution_manager_id || undefined,
      solution_manager_head_id: deal.solution_manager_head_id || undefined,
      linked_to_impl: deal.linked_to_impl ? parseBoolean(deal.linked_to_impl) : false,
      eligible_for_perpetual_incentive: deal.eligible_for_perpetual_incentive ? parseBoolean(deal.eligible_for_perpetual_incentive) : false,
      status: deal.status || "draft",
      notes: deal.notes || undefined,
    }));
  };

  const validateDeals = (deals: ParsedDeal[]): ValidationError[] => {
    const errors: ValidationError[] = [];
    const employeeIds = new Set(employees.map((e) => e.employee_id));

    deals.forEach((deal, index) => {
      const row = index + 2;

      if (!deal.project_id) {
        errors.push({ row, field: "project_id", message: "Project ID is required" });
      }
      if (!deal.customer_code) {
        errors.push({ row, field: "customer_code", message: "Customer code is required" });
      }
      if (!deal.region) {
        errors.push({ row, field: "region", message: "Region is required" });
      }
      if (!deal.country) {
        errors.push({ row, field: "country", message: "Country is required" });
      }
      if (!deal.product) {
        errors.push({ row, field: "product", message: "Product is required" });
      }
      if (!deal.bu) {
        errors.push({ row, field: "bu", message: "Business unit is required" });
      }

      // Case-insensitive validation for type_of_proposal
      const normalizedProposalType = deal.type_of_proposal?.toLowerCase().trim();
      if (!validProposalTypes.includes(normalizedProposalType as typeof validProposalTypes[number])) {
        errors.push({
          row,
          field: "type_of_proposal",
          message: `Invalid type. Must be one of: ${validProposalTypes.join(", ")}`,
        });
      }

      const parsedDate = parseMonthYear(deal.month_year);
      if (!parsedDate) {
        errors.push({ row, field: "month_year", message: "Invalid date format. Use MMM-YYYY (e.g., Jan-2026)" });
      } else if (!isMonthInFiscalYear(parsedDate)) {
        errors.push({
          row,
          field: "month_year",
          message: `Month must be within fiscal year ${selectedYear}`,
        });
      }

      // Validate participant employee IDs if provided
      const participantFields = [
        "sales_rep_id", "sales_head_id", "sales_engineering_id",
        "sales_engineering_head_id", "product_specialist_id", "product_specialist_head_id",
        "solution_manager_id", "solution_manager_head_id"
      ];
      participantFields.forEach((field) => {
        const empId = deal[field as keyof ParsedDeal] as string | undefined;
        if (empId && !employeeIds.has(empId)) {
          errors.push({ row, field, message: `Employee ID "${empId}" not found` });
        }
      });
    });

    return errors;
  };

  const handleDownloadErrors = () => {
    const headers = ["Row", "Field", "Error Message"];
    const csvContent = [
      headers.join(","),
      ...validationErrors.map(
        (err) => `${err.row},"${err.field}","${err.message.replace(/"/g, '""')}"`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals_upload_errors_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (extension === "csv") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const deals = parseCSV(text);
          const errors = validateDeals(deals);
          setParsedDeals(deals);
          setValidationErrors(errors);
        };
        reader.readAsText(file);
      } else if (extension === "xlsx" || extension === "xls") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          const rows = parseExcel(buffer);
          const deals = rowsToParsedDeals(rows);
          const errors = validateDeals(deals);
          setParsedDeals(deals);
          setValidationErrors(errors);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [employees, selectedYear, isMonthInFiscalYear]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const getEmployeeName = (employeeId: string | undefined): string | null => {
    if (!employeeId) return null;
    const emp = employees.find((e) => e.employee_id === employeeId);
    return emp?.full_name || null;
  };

  const uploadMutation = useMutation({
    mutationFn: async (deals: ParsedDeal[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];

        // Build deal data with employee names
        const dealData = {
          project_id: deal.project_id,
          customer_code: deal.customer_code,
          customer_name: deal.customer_name || null,
          region: deal.region,
          country: deal.country,
          bu: deal.bu,
          product: deal.product,
          type_of_proposal: deal.type_of_proposal,
          gp_margin_percent: deal.gp_margin_percent,
          month_year: deal.month_year,
          first_year_amc_usd: deal.first_year_amc_usd || 0,
          first_year_subscription_usd: deal.first_year_subscription_usd || 0,
          managed_services_usd: deal.managed_services_usd || 0,
          implementation_usd: deal.implementation_usd || 0,
          cr_usd: deal.cr_usd || 0,
          er_usd: deal.er_usd || 0,
          tcv_usd: deal.tcv_usd || 0,
          sales_rep_employee_id: deal.sales_rep_id || null,
          sales_rep_name: getEmployeeName(deal.sales_rep_id),
          sales_head_employee_id: deal.sales_head_id || null,
          sales_head_name: getEmployeeName(deal.sales_head_id),
          sales_engineering_employee_id: deal.sales_engineering_id || null,
          sales_engineering_name: getEmployeeName(deal.sales_engineering_id),
          sales_engineering_head_employee_id: deal.sales_engineering_head_id || null,
          sales_engineering_head_name: getEmployeeName(deal.sales_engineering_head_id),
          product_specialist_employee_id: deal.product_specialist_id || null,
          product_specialist_name: getEmployeeName(deal.product_specialist_id),
          product_specialist_head_employee_id: deal.product_specialist_head_id || null,
          product_specialist_head_name: getEmployeeName(deal.product_specialist_head_id),
          solution_manager_employee_id: deal.solution_manager_id || null,
          solution_manager_name: getEmployeeName(deal.solution_manager_id),
          solution_manager_head_employee_id: deal.solution_manager_head_id || null,
          solution_manager_head_name: getEmployeeName(deal.solution_manager_head_id),
          linked_to_impl: deal.linked_to_impl || false,
          eligible_for_perpetual_incentive: deal.eligible_for_perpetual_incentive || false,
          status: deal.status || "draft",
          notes: deal.notes,
        };

        const { error: dealError } = await supabase
          .from("deals")
          .insert(dealData);

        if (dealError) throw dealError;

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

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Download Template */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">CSV Template (Updated Schema)</span>
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
              All deals must have a month_year (e.g., Jan-{selectedYear}) within FY {selectedYear}.
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
              <p className="text-sm text-primary">Drop the file here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium">Drag & drop a CSV or Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">Supported: .csv, .xlsx, .xls</p>
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
                <div className="space-y-2">
                  <ScrollArea className="h-32 border rounded-md p-3">
                    <div className="space-y-1">
                      {validationErrors.map((error, idx) => (
                        <div key={idx} className="text-xs text-destructive">
                          Row {error.row}, {error.field}: {error.message}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download Errors
                  </Button>
                </div>
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
