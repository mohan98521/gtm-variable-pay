/**
 * Payout Adjustments Component
 * 
 * UI for managing payout adjustments within a run:
 * - List of adjustments with status badges
 * - Create new adjustment dialog
 * - Approve/reject actions
 */

import { useState } from "react";
import { format } from "date-fns";
import { 
  usePayoutAdjustments, 
  useCreateAdjustment, 
  useApproveAdjustment,
  useDeleteAdjustment,
  PayoutAdjustment 
} from "@/hooks/usePayoutAdjustments";
import { useEmployeePayoutBreakdown, EmployeePayoutSummary } from "@/hooks/useMonthlyPayouts";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  CheckCheck,
  Trash2
} from "lucide-react";

interface PayoutAdjustmentsProps {
  payoutRunId: string;
  monthYear: string;
  runStatus: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  applied: { label: "Applied", variant: "outline", icon: CheckCheck },
};

const ADJUSTMENT_TYPES = [
  { value: 'correction', label: 'Correction' },
  { value: 'clawback_reversal', label: 'Clawback Reversal' },
  { value: 'manual_override', label: 'Manual Override' },
];

export function PayoutAdjustments({ payoutRunId, monthYear, runStatus }: PayoutAdjustmentsProps) {
  const { data: adjustments, isLoading } = usePayoutAdjustments(payoutRunId);
  const { data: employees } = useEmployeePayoutBreakdown(payoutRunId);
  
  const createMutation = useCreateAdjustment();
  const approveMutation = useApproveAdjustment();
  const deleteMutation = useDeleteAdjustment();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePayoutSummary | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<string>('correction');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  
  const canCreateAdjustment = runStatus === 'review';
  const canApprove = runStatus === 'review' || runStatus === 'approved';
  
  const handleOpenCreate = () => {
    setSelectedEmployee(null);
    setAdjustmentType('correction');
    setAdjustmentAmount('');
    setReason('');
    setShowCreateDialog(true);
  };
  
  const handleCreate = async () => {
    if (!selectedEmployee || !adjustmentAmount || !reason) return;
    
    await createMutation.mutateAsync({
      payoutRunId,
      employeeId: selectedEmployee.employeeId,
      adjustmentType: adjustmentType as 'correction' | 'clawback_reversal' | 'manual_override',
      originalAmountUsd: selectedEmployee.totalUsd,
      adjustmentAmountUsd: parseFloat(adjustmentAmount),
      localCurrency: selectedEmployee.localCurrency,
      exchangeRateUsed: selectedEmployee.vpCompRate,
      reason,
    });
    
    setShowCreateDialog(false);
  };
  
  const handleApprove = async (adj: PayoutAdjustment, approved: boolean) => {
    await approveMutation.mutateAsync({
      adjustmentId: adj.id,
      approved,
      payoutRunId,
    });
  };
  
  const handleDelete = async (adj: PayoutAdjustment) => {
    await deleteMutation.mutateAsync({
      adjustmentId: adj.id,
      payoutRunId,
    });
  };
  
  const formatCurrency = (value: number, currency: string = 'USD') => {
    const symbol = currency === 'USD' ? '$' : currency;
    const formatted = Math.abs(value).toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
    const sign = value < 0 ? '-' : '+';
    return currency === 'USD' ? `${sign}$${formatted}` : `${sign}${formatted} ${currency}`;
  };
  
  const pendingCount = adjustments?.filter(a => a.status === 'pending').length || 0;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            Adjustments
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Corrections, clawback reversals, and manual overrides
          </CardDescription>
        </div>
        {canCreateAdjustment && (
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Adjustment
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : adjustments && adjustments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount (USD)</TableHead>
                <TableHead className="text-right">Amount (Local)</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj) => {
                const config = STATUS_CONFIG[adj.status] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                const emp = employees?.find(e => e.employeeId === adj.employee_id);
                
                return (
                  <TableRow key={adj.id}>
                    <TableCell className="font-medium">
                      {emp?.employeeName || adj.employee_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {adj.adjustment_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(adj.adjustment_amount_usd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(adj.adjustment_amount_local, adj.local_currency)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={adj.reason}>
                      {adj.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {adj.status === 'pending' && canApprove && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => handleApprove(adj, true)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleApprove(adj, false)}
                              disabled={approveMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {adj.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(adj)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No adjustments for this payout run.
          </div>
        )}
      </CardContent>
      
      {/* Create Adjustment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payout Adjustment</DialogTitle>
            <DialogDescription>
              Create a correction or override for {monthYear}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <SearchableSelect
                value={selectedEmployee?.employeeId || ''}
                onValueChange={(val) => setSelectedEmployee(employees?.find(e => e.employeeId === val) || null)}
                options={employees?.map((emp) => ({
                  value: emp.employeeId,
                  label: `${emp.employeeName} (${emp.employeeCode})`,
                })) || []}
                placeholder="Select employee"
                searchPlaceholder="Search employees..."
              />
            </div>
            
            {selectedEmployee && (
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                Current payout: ${selectedEmployee.totalUsd.toLocaleString()} USD 
                ({selectedEmployee.localCurrency})
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Adjustment Amount (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="Enter positive or negative amount"
              />
              <p className="text-xs text-muted-foreground">
                Use negative for deductions, positive for additions
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for this adjustment..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!selectedEmployee || !adjustmentAmount || !reason || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
