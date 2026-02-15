/**
 * Payout Run Management
 * 
 * Admin interface for managing payout runs:
 * - List of payout runs with status badges
 * - Create new payout run
 * - Run calculations
 * - Status transitions
 */

import { useState } from "react";
import { format, parse } from "date-fns";
import { 
  usePayoutRuns, 
  useCreatePayoutRun, 
  useRunPayoutCalculation,
  useUpdatePayoutRunStatus,
  useDeletePayoutRun,
  useValidatePayoutRun,
  PayoutRun 
} from "@/hooks/usePayoutRuns";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  Calculator, 
  Eye, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Lock,
  Play,
  Download
} from "lucide-react";
import { generateCSV, downloadCSV } from "@/lib/csvExport";
import { PayoutRunDetail } from "./PayoutRunDetail";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  calculating: { label: "Calculating", variant: "outline", icon: Loader2 },
  review: { label: "Review", variant: "outline", icon: Eye },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  finalized: { label: "Finalized", variant: "default", icon: Lock },
  paid: { label: "Paid", variant: "default", icon: CheckCircle2 },
};

export function PayoutRunManagement() {
  const { selectedYear } = useFiscalYear();
  const { data: payoutRuns, isLoading } = usePayoutRuns(selectedYear);
  
  const createMutation = useCreatePayoutRun();
  const calculateMutation = useRunPayoutCalculation();
  const updateStatusMutation = useUpdatePayoutRunStatus();
  const deleteMutation = useDeletePayoutRun();
  const validateMutation = useValidatePayoutRun();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [viewingRun, setViewingRun] = useState<PayoutRun | null>(null);
  const [deletingRun, setDeletingRun] = useState<PayoutRun | null>(null);
  const [calculatingRun, setCalculatingRun] = useState<PayoutRun | null>(null);
  const [calcProgress, setCalcProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Generate month options for the selected year
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
      value: `${selectedYear}-${month}`,
      label: format(new Date(selectedYear, i, 1), 'MMMM yyyy'),
    };
  });
  
  // Filter out months that already have a payout run
  const existingMonths = new Set(payoutRuns?.map(r => r.month_year?.substring(0, 7)) || []);
  const availableMonths = monthOptions.filter(m => !existingMonths.has(m.value));
  
  const handleOpenCreateDialog = () => {
    setSelectedMonth(availableMonths[0]?.value || "");
    setNotes("");
    setValidationResult(null);
    setShowCreateDialog(true);
  };
  
  const handleValidateMonth = async () => {
    if (!selectedMonth) return;
    const result = await validateMutation.mutateAsync(selectedMonth);
    setValidationResult(result);
  };
  
  const handleCreateRun = async () => {
    if (!selectedMonth) return;
    await createMutation.mutateAsync({ monthYear: selectedMonth, notes: notes || undefined });
    setShowCreateDialog(false);
  };
  
  const handleCalculate = async (run: PayoutRun) => {
    setCalculatingRun(run);
    setCalcProgress(null);
    try {
      await calculateMutation.mutateAsync({ 
        runId: run.id, 
        monthYear: run.month_year,
        onProgress: (current, total) => setCalcProgress({ current, total }),
      });
    } finally {
      setCalculatingRun(null);
      setCalcProgress(null);
    }
  };
  
  const handleStatusChange = async (run: PayoutRun, newStatus: 'review' | 'approved' | 'finalized' | 'paid') => {
    await updateStatusMutation.mutateAsync({ runId: run.id, status: newStatus });
  };
  
  const handleDelete = async () => {
    if (!deletingRun) return;
    await deleteMutation.mutateAsync(deletingRun.id);
    setDeletingRun(null);
  };
  
  const formatMonthYear = (monthYear: string) => {
    try {
      const date = parse(monthYear, 'yyyy-MM', new Date());
      return format(date, 'MMMM yyyy');
    } catch {
      return monthYear;
    }
  };
  
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  if (viewingRun) {
    return (
      <PayoutRunDetail 
        run={viewingRun} 
        onBack={() => setViewingRun(null)} 
      />
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payout Runs</h2>
          <p className="text-sm text-muted-foreground">
            Manage monthly payout calculations and approvals
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} disabled={availableMonths.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Payout Run
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">FY {selectedYear} Payout Runs</CardTitle>
          <CardDescription>
            Status flow: Draft → Review → Approved → Finalized → Paid
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payoutRuns && payoutRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Variable Pay</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Total Payout</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutRuns.map((run) => {
                  const config = STATUS_CONFIG[run.run_status] || STATUS_CONFIG.draft;
                  const StatusIcon = config.icon;
                  const isCalculating = calculatingRun?.id === run.id;
                  
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {formatMonthYear(run.month_year)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(run.total_variable_pay_usd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(run.total_commissions_usd)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(run.total_payout_usd)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(run.run_status === 'draft' || run.run_status === 'calculating') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCalculate(run)}
                                disabled={isCalculating || calculateMutation.isPending || run.run_status === 'calculating'}
                              >
                                {isCalculating || run.run_status === 'calculating' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Calculator className="h-4 w-4" />
                                )}
                                <span className="ml-1">
                                  {isCalculating && calcProgress
                                    ? `Processing ${calcProgress.current}/${calcProgress.total}...`
                                    : run.run_status === 'calculating' ? 'Calculating...' : 'Calculate'}
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeletingRun(run)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {run.run_status === 'review' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCalculate(run)}
                                disabled={isCalculating || calculateMutation.isPending}
                              >
                                {isCalculating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                                <span className="ml-1">Recalculate</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(run, 'approved')}
                              >
                                Approve
                              </Button>
                            </>
                          )}
                          {run.run_status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(run, 'finalized')}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Finalize
                            </Button>
                          )}
                          {run.run_status === 'finalized' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(run, 'paid')}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark as Paid
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingRun(run)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Calculator className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No payout runs for {selectedYear}
              </h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Create a payout run to start calculating employee payouts for a specific month.
              </p>
              <Button onClick={handleOpenCreateDialog}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Payout Run
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create Payout Run Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout Run</DialogTitle>
            <DialogDescription>
              Select a month to create a new payout calculation run.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes for this payout run..."
              />
            </div>
            
            {selectedMonth && (
              <Button 
                variant="outline" 
                onClick={handleValidateMonth}
                disabled={validateMutation.isPending}
                className="w-full"
              >
                {validateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validate Prerequisites
              </Button>
            )}
            
            {validationResult && (
              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                      <AlertCircle className="h-4 w-4" />
                      Validation Errors
                    </div>
                    <ul className="list-disc list-inside text-destructive/80">
                      {validationResult.errors.map((e: any, i: number) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div className="rounded-md bg-warning/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-warning-foreground font-medium mb-1">
                      <AlertCircle className="h-4 w-4" />
                      Warnings
                    </div>
                    <ul className="list-disc list-inside text-warning-foreground/80">
                      {validationResult.warnings.map((w: any, i: number) => (
                        <li key={i}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.isValid && (
                  <div className="rounded-md bg-success/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-success font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      All prerequisites validated successfully
                    </div>
                  </div>
                )}
                {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const rows = [
                        ...validationResult.errors.map((e: any) => ({
                          type: "Error",
                          category: e.category || "",
                          message: e.message,
                          details: e.details?.join("; ") || "",
                        })),
                        ...validationResult.warnings.map((w: any) => ({
                          type: "Warning",
                          category: w.category || "",
                          message: w.message,
                          details: w.details?.join("; ") || "",
                        })),
                      ];
                      const csv = generateCSV(rows, [
                        { key: "type", header: "Type" },
                        { key: "category", header: "Category" },
                        { key: "message", header: "Message" },
                        { key: "details", header: "Details" },
                      ]);
                      downloadCSV(csv, `payout_validation_${selectedMonth}.csv`);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Errors & Warnings
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRun} 
              disabled={!selectedMonth || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRun} onOpenChange={(open) => !open && setDeletingRun(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payout Run</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payout run for {deletingRun && formatMonthYear(deletingRun.month_year)}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
