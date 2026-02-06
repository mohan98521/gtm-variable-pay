import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { format, parse } from "date-fns";
import {
  Upload,
  Download,
  Plus,
  Edit,
  Trash2,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrencies } from "@/hooks/useCurrencies";
import { CurrencyManagement } from "./CurrencyManagement";

interface ExchangeRate {
  id: string;
  currency_code: string;
  month_year: string;
  rate_to_usd: number;
  created_at: string;
}

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
}

// Currency options are now fetched dynamically via useCurrencies hook

export function ExchangeRateManagement() {
  const queryClient = useQueryClient();
  const { currencies: activeCurrencies, currencyOptions: dynamicCurrencyOptions } = useCurrencies();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<ExchangeRate | null>(null);
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  // Form state for add/edit
  const [formData, setFormData] = useState({
    currency_code: "",
    month_year: "",
    rate_to_usd: "",
  });

  // Fetch exchange rates
  const { data: exchangeRates, isLoading } = useQuery({
    queryKey: ["exchange_rates", filterCurrency, filterYear],
    queryFn: async () => {
      let query = supabase
        .from("exchange_rates")
        .select("*")
        .order("month_year", { ascending: false });

      if (filterCurrency && filterCurrency !== "all") {
        query = query.eq("currency_code", filterCurrency);
      }

      if (filterYear && filterYear !== "all") {
        query = query
          .gte("month_year", `${filterYear}-01-01`)
          .lte("month_year", `${filterYear}-12-31`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExchangeRate[];
    },
  });

  // Get unique currencies from employees for validation
  const { data: employeeCurrencies } = useQuery({
    queryKey: ["employee_currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("local_currency")
        .neq("local_currency", "USD");
      
      if (error) throw error;
      const unique = [...new Set(data.map(e => e.local_currency))];
      return unique.filter(Boolean) as string[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { currency_code: string; month_year: string; rate_to_usd: number }) => {
      const { error } = await supabase.from("exchange_rates").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      setShowAddDialog(false);
      resetForm();
      toast.success("Exchange rate added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; rate_to_usd: number }) => {
      const { error } = await supabase
        .from("exchange_rates")
        .update({ rate_to_usd: data.rate_to_usd })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      setEditingRate(null);
      resetForm();
      toast.success("Exchange rate updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exchange_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      setDeletingRate(null);
      toast.success("Exchange rate deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({ currency_code: "", month_year: "", rate_to_usd: "" });
  };

  const generateTemplate = () => {
    const headers = ["currency_code", "month_year", "rate_to_usd"];
    const sampleRows = [
      ["INR", "2026-01", "85.50"],
      ["AED", "2026-01", "3.67"],
      ["KES", "2026-01", "130.00"],
    ];
    
    const csvContent = [headers.join(","), ...sampleRows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "exchange_rates_template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const parseCSV = (text: string): Array<{ currency_code: string; month_year: string; rate_to_usd: string }> => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows: Array<{ currency_code: string; month_year: string; rate_to_usd: string }> = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push({
        currency_code: row.currency_code || "",
        month_year: row.month_year || "",
        rate_to_usd: row.rate_to_usd || "",
      });
    }
    
    return rows;
  };

  const processUpload = async (rows: Array<{ currency_code: string; month_year: string; rate_to_usd: string }>) => {
    const result: UploadResult = { created: 0, updated: 0, errors: [] };
    const total = rows.length;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(Math.round(((i + 1) / total) * 100));
      
      try {
        if (!row.currency_code || !row.month_year || !row.rate_to_usd) {
          result.errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Parse month_year (accepts YYYY-MM format)
        let monthDate: string;
        if (row.month_year.match(/^\d{4}-\d{2}$/)) {
          monthDate = `${row.month_year}-01`;
        } else if (row.month_year.match(/^\d{4}-\d{2}-\d{2}$/)) {
          monthDate = row.month_year;
        } else {
          result.errors.push(`Row ${i + 1}: Invalid month_year format (use YYYY-MM)`);
          continue;
        }

        const rateValue = parseFloat(row.rate_to_usd);
        if (isNaN(rateValue) || rateValue <= 0) {
          result.errors.push(`Row ${i + 1}: Invalid rate value`);
          continue;
        }

        // Check if exists
        const { data: existing } = await supabase
          .from("exchange_rates")
          .select("id")
          .eq("currency_code", row.currency_code.toUpperCase())
          .eq("month_year", monthDate)
          .maybeSingle();

        if (existing) {
          // Update
          const { error } = await supabase
            .from("exchange_rates")
            .update({ rate_to_usd: rateValue })
            .eq("id", existing.id);
          
          if (error) throw error;
          result.updated++;
        } else {
          // Insert
          const { error } = await supabase.from("exchange_rates").insert({
            currency_code: row.currency_code.toUpperCase(),
            month_year: monthDate,
            rate_to_usd: rateValue,
          });
          
          if (error) throw error;
          result.created++;
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
    setUploadResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast.error("No valid data found in CSV");
        setIsProcessing(false);
        return;
      }

      const result = await processUpload(rows);
      setUploadResult(result);
      
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      
      if (result.errors.length === 0) {
        toast.success(`Upload complete: ${result.created} created, ${result.updated} updated`);
      } else {
        toast.warning(`Upload completed with ${result.errors.length} errors`);
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

  const handleAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (rate: ExchangeRate) => {
    setFormData({
      currency_code: rate.currency_code,
      month_year: rate.month_year.substring(0, 7), // YYYY-MM format
      rate_to_usd: rate.rate_to_usd.toString(),
    });
    setEditingRate(rate);
  };

  const handleSubmitAdd = () => {
    if (!formData.currency_code || !formData.month_year || !formData.rate_to_usd) {
      toast.error("Please fill all fields");
      return;
    }

    const rate = parseFloat(formData.rate_to_usd);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    createMutation.mutate({
      currency_code: formData.currency_code,
      month_year: `${formData.month_year}-01`,
      rate_to_usd: rate,
    });
  };

  const handleSubmitEdit = () => {
    if (!editingRate || !formData.rate_to_usd) {
      toast.error("Please enter a rate");
      return;
    }

    const rate = parseFloat(formData.rate_to_usd);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    updateMutation.mutate({
      id: editingRate.id,
      rate_to_usd: rate,
    });
  };

  const formatMonth = (dateStr: string) => {
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  // Get years for filter
  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  // Calculate missing currencies (employees have currency but no rate for current month)
  const currentMonth = format(new Date(), "yyyy-MM");
  const missingRates = employeeCurrencies?.filter(currency => {
    return !exchangeRates?.some(
      rate => rate.currency_code === currency && rate.month_year.startsWith(currentMonth)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Missing Rates Warning */}
      {missingRates.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Missing Exchange Rates</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The following currencies are used by employees but have no rate for {format(new Date(), "MMMM yyyy")}:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingRates.map(currency => (
                    <Badge key={currency} variant="outline" className="border-warning text-warning">
                      {currency}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--azentio-teal))]" />
            Exchange Rate Bulk Upload
          </CardTitle>
          <CardDescription>
            Upload monthly market exchange rates via CSV. Rates are used for commission payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button variant="accent" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rate Manually
            </Button>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-[hsl(var(--azentio-teal))] bg-[hsl(var(--azentio-teal))]/5"
                : "border-muted-foreground/25 hover:border-[hsl(var(--azentio-teal))]/50"
            } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            {isDragActive ? (
              <p className="text-[hsl(var(--azentio-teal))] font-medium">Drop the CSV file here...</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Drag & drop a CSV file here</p>
                <p className="text-sm text-muted-foreground">Format: currency_code, month_year (YYYY-MM), rate_to_usd</p>
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

          {uploadResult && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  {uploadResult.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  Upload Results
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between p-2 bg-success/10 rounded">
                    <span>Created:</span>
                    <span className="font-medium">{uploadResult.created}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-accent/10 rounded">
                    <span>Updated:</span>
                    <span className="font-medium">{uploadResult.updated}</span>
                  </div>
                </div>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-destructive mb-2">
                      Errors ({uploadResult.errors.length}):
                    </p>
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                      {uploadResult.errors.map((err, i) => (
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

      {/* Exchange Rates Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[hsl(var(--azentio-teal))]" />
                Exchange Rates
              </CardTitle>
              <CardDescription>Monthly market rates for commission conversions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  {activeCurrencies.filter(c => c.code !== 'USD').map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : exchangeRates && exchangeRates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Rate to USD</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <Badge variant="outline">{rate.currency_code}</Badge>
                    </TableCell>
                    <TableCell>{formatMonth(rate.month_year)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {rate.rate_to_usd.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(rate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingRate(rate)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Exchange Rates</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Upload exchange rates via CSV or add them manually.
              </p>
              <Button variant="accent" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Exchange Rate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exchange Rate</DialogTitle>
            <DialogDescription>
              Add a monthly market exchange rate for commission calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={formData.currency_code}
                onValueChange={(value) => setFormData({ ...formData, currency_code: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {activeCurrencies.filter(c => c.code !== 'USD').map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={formData.month_year}
                onChange={(e) => setFormData({ ...formData, month_year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate to USD</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="e.g., 85.5000"
                value={formData.rate_to_usd}
                onChange={(e) => setFormData({ ...formData, rate_to_usd: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Enter how many units of this currency equal 1 USD
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRate} onOpenChange={(open) => !open && setEditingRate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exchange Rate</DialogTitle>
            <DialogDescription>
              Update the exchange rate for {editingRate?.currency_code} - {editingRate && formatMonth(editingRate.month_year)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rate to USD</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.rate_to_usd}
                onChange={(e) => setFormData({ ...formData, rate_to_usd: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRate} onOpenChange={(open) => !open && setDeletingRate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exchange Rate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the rate for {deletingRate?.currency_code} - {deletingRate && formatMonth(deletingRate.month_year)}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRate && deleteMutation.mutate(deletingRate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Currency Management Section */}
      <CurrencyManagement />
    </div>
  );
}
