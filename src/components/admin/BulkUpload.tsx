import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
}

// All 26 employee fields (17 core + 9 compensation)
const EMPLOYEE_HEADERS = [
  "full_name",
  "email",
  "employee_id",
  "designation",
  "sales_function",
  "business_unit",
  "group_name",
  "function_area",
  "manager_employee_id",
  "date_of_hire",
  "is_active",
  "city",
  "country",
  "local_currency",
  "department",
  "region",
  "departure_date",
  // New compensation target fields
  "employee_role",
  "incentive_type",
  "target_bonus_percent",
  "tfp_local_currency",
  "tvp_local_currency",
  "ote_local_currency",
  "tfp_usd",
  "tvp_usd",
  "ote_usd",
];

// Optional field for linking employee to a compensation plan
const OPTIONAL_HEADERS = ["plan_name"];

export function BulkUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const queryClient = useQueryClient();

  const generateTemplate = () => {
    const allHeaders = [...EMPLOYEE_HEADERS, ...OPTIONAL_HEADERS];
    const csvContent = allHeaders.join(",") + "\n";
    const sampleRow = [
      // Core employee fields (17)
      "John Doe",
      "john.doe@example.com",
      "EMP001",
      "Sales Manager",
      "Hunter",
      "Enterprise",
      "GTM",
      "Sales",
      "EMP000",
      "2024-01-15",
      "true",
      "New York",
      "USA",
      "USD",
      "Sales",
      "North America",
      "",
      // Compensation target fields (9)
      "Individual Contributor",
      "Standard",
      "20",
      "80000",
      "20000",
      "100000",
      "80000",
      "20000",
      "100000",
      // Optional plan linking
      "Standard Plan 2026",
    ].join(",");
    
    const blob = new Blob([csvContent + sampleRow], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk_upload_template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded successfully");
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
    
    return rows;
  };

  const processUpload = async (rows: Record<string, string>[]) => {
    const result: UploadResult = { created: 0, updated: 0, errors: [] };
    const total = rows.length;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(Math.round(((i + 1) / total) * 100));
      
      try {
        // Prepare employee data with all 26 fields (17 core + 9 compensation)
        const employeeData = {
          full_name: row.full_name,
          email: row.email,
          employee_id: row.employee_id,
          designation: row.designation || null,
          sales_function: row.sales_function || null,
          business_unit: row.business_unit || null,
          group_name: row.group_name || null,
          function_area: row.function_area || null,
          manager_employee_id: row.manager_employee_id || null,
          date_of_hire: row.date_of_hire || null,
          is_active: row.is_active?.toLowerCase() !== "false",
          city: row.city || null,
          country: row.country || null,
          local_currency: row.local_currency || "USD",
          department: row.department || null,
          region: row.region || null,
          departure_date: row.departure_date || null,
          // New compensation target fields
          employee_role: row.employee_role || null,
          incentive_type: row.incentive_type || null,
          target_bonus_percent: row.target_bonus_percent ? parseFloat(row.target_bonus_percent) : null,
          tfp_local_currency: row.tfp_local_currency ? parseFloat(row.tfp_local_currency) : null,
          tvp_local_currency: row.tvp_local_currency ? parseFloat(row.tvp_local_currency) : null,
          ote_local_currency: ((row.tfp_local_currency ? parseFloat(row.tfp_local_currency) : 0) + (row.tvp_local_currency ? parseFloat(row.tvp_local_currency) : 0)) || null,
          tfp_usd: row.tfp_usd ? parseFloat(row.tfp_usd) : null,
          tvp_usd: row.tvp_usd ? parseFloat(row.tvp_usd) : null,
          ote_usd: ((row.tfp_usd ? parseFloat(row.tfp_usd) : 0) + (row.tvp_usd ? parseFloat(row.tvp_usd) : 0)) || null,
        };

        // Check if employee exists
        const { data: existingEmployee } = await supabase
          .from("employees")
          .select("id")
          .or(`email.eq.${row.email},employee_id.eq.${row.employee_id}`)
          .maybeSingle();

        let employeeId: string;

        if (existingEmployee) {
          // Update existing employee
          const { error } = await supabase
            .from("employees")
            .update(employeeData)
            .eq("id", existingEmployee.id);
          
          if (error) throw error;
          employeeId = existingEmployee.id;
          result.updated++;
        } else {
          // Create new employee
          const { data, error } = await supabase
            .from("employees")
            .insert(employeeData)
            .select("id")
            .single();
          
          if (error) throw error;
          employeeId = data.id;
          result.created++;
        }

        // Handle user_targets if plan_name is provided
        if (row.plan_name) {
          // Find comp plan by name
          const { data: plan } = await supabase
            .from("comp_plans")
            .select("id")
            .eq("name", row.plan_name)
            .maybeSingle();

          if (plan) {
            // Find auth user by email for user_targets
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", row.email)
              .maybeSingle();

            if (profile) {
              // Auto-calculate effective dates
              const currentYear = new Date().getFullYear();
              const hireDate = row.date_of_hire ? new Date(row.date_of_hire) : null;
              
              let effectiveStart = `${currentYear}-01-01`;
              if (hireDate && hireDate.getFullYear() === currentYear) {
                effectiveStart = row.date_of_hire; // Use hire date if joined this year
              }
              const effectiveEnd = `${currentYear}-12-31`;

              // Use compensation values from employee data (no duplicates)
              const targetData = {
                user_id: profile.id,
                plan_id: plan.id,
                effective_start_date: effectiveStart,
                effective_end_date: effectiveEnd,
                currency: employeeData.local_currency || "USD",
                target_bonus_percent: employeeData.target_bonus_percent,
                tfp_local_currency: employeeData.tfp_local_currency,
                ote_local_currency: employeeData.ote_local_currency,
                tfp_usd: employeeData.tfp_usd,
                target_bonus_usd: employeeData.tvp_usd, // TVP in USD as target bonus
                ote_usd: employeeData.ote_usd,
              } as const;

              // Upsert user_targets
              const { data: existingTarget } = await supabase
                .from("user_targets")
                .select("id")
                .eq("user_id", profile.id)
                .eq("plan_id", plan.id)
                .eq("effective_start_date", effectiveStart)
                .maybeSingle();

              if (existingTarget) {
                await supabase
                  .from("user_targets")
                  .update({
                    currency: targetData.currency,
                    target_bonus_percent: targetData.target_bonus_percent,
                    tfp_local_currency: targetData.tfp_local_currency,
                    ote_local_currency: targetData.ote_local_currency,
                    tfp_usd: targetData.tfp_usd,
                    target_bonus_usd: targetData.target_bonus_usd,
                    ote_usd: targetData.ote_usd,
                  })
                  .eq("id", existingTarget.id);
              } else {
                await supabase.from("user_targets").insert([{
                  user_id: targetData.user_id,
                  plan_id: targetData.plan_id,
                  effective_start_date: targetData.effective_start_date,
                  effective_end_date: targetData.effective_end_date,
                  target_value_annual: 0, // Will be uploaded separately
                  currency: targetData.currency,
                  target_bonus_percent: targetData.target_bonus_percent,
                  tfp_local_currency: targetData.tfp_local_currency,
                  ote_local_currency: targetData.ote_local_currency,
                  tfp_usd: targetData.tfp_usd,
                  target_bonus_usd: targetData.target_bonus_usd,
                  ote_usd: targetData.ote_usd,
                }]);
              }
            }
          }
        }
      } catch (error: any) {
        result.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    return result;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast.error("No valid data found in CSV");
        setIsProcessing(false);
        return;
      }

      const uploadResult = await processUpload(rows);
      setResult(uploadResult);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["user_targets"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      
      if (uploadResult.errors.length === 0) {
        toast.success(`Upload complete: ${uploadResult.created} created, ${uploadResult.updated} updated`);
      } else {
        toast.warning(`Upload completed with ${uploadResult.errors.length} errors`);
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: isProcessing,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--azentio-teal))]" />
            Employee Data Management - Bulk Upload
          </CardTitle>
        <CardDescription>
            Upload employee data (26 fields) via CSV. Optionally specify plan_name to link employees to compensation plans. Records are matched by Email or Employee ID for upsert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Supported Fields (26 Employee Fields):</h4>
            <p className="text-sm text-muted-foreground">
              <strong>Core (17):</strong> Full Name, Email, Employee ID, Designation, Sales Function, Business Unit, Group Name, 
              Function Area, Manager (Employee ID), Date of Joining, Is Active, City, Country, Local Currency, 
              Department, Region, Last Working Day
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Compensation (9):</strong> Employee Role, Incentive Type, Target Bonus %, TFP (LC), TVP (LC), 
              OTE (LC), TFP (USD), TVP (USD), OTE (USD)
            </p>
          </div>

          <Button 
            onClick={generateTemplate} 
            variant="outline"
            className="border-[hsl(var(--azentio-navy))] text-[hsl(var(--azentio-navy))] hover:bg-[hsl(var(--azentio-navy))]/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-[hsl(var(--azentio-teal))] bg-[hsl(var(--azentio-teal))]/5"
                : "border-muted-foreground/25 hover:border-[hsl(var(--azentio-teal))]/50"
            } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-[hsl(var(--azentio-teal))] font-medium">Drop the CSV file here...</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Drag & drop a CSV file here</p>
                <p className="text-sm text-muted-foreground">or click to select a file</p>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing upload...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {result && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  {result.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  Upload Results
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between p-2 bg-success/10 rounded">
                    <span>Created:</span>
                    <span className="font-medium">{result.created}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-accent/10 rounded">
                    <span>Updated:</span>
                    <span className="font-medium">{result.updated}</span>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-destructive">Errors ({result.errors.length}):</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const errorData = result.errors.map((err) => {
                            const match = err.match(/^Row (\d+): (.+)$/);
                            return {
                              row: match ? match[1] : "",
                              message: match ? match[2] : err,
                            };
                          });
                          const csv = generateCSV(errorData, [
                            { key: "row", header: "Row Number" },
                            { key: "message", header: "Error Message" },
                          ]);
                          downloadCSV(csv, `employee_upload_errors_${new Date().toISOString().split("T")[0]}.csv`);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Errors
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-destructive">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
