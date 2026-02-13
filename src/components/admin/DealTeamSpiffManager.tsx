import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfiles } from "@/hooks/useProfiles";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import {
  useDealTeamSpiffConfig,
  useUpdateDealTeamSpiffConfig,
  useDealTeamSpiffAllocations,
  useUpsertDealTeamSpiffAllocations,
  useApproveDealTeamSpiffAllocations,
  useRejectDealTeamSpiffAllocations,
  DealTeamSpiffAllocation,
} from "@/hooks/useDealTeamSpiffs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings2, DollarSign, CheckCircle2, XCircle, Edit, Trash2, Plus } from "lucide-react";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { usePermissions } from "@/hooks/usePermissions";

// Participant role fields on the deals table (excluding sales_rep and sales_head)
const TEAM_PARTICIPANT_ROLES = [
  { field: "sales_engineering_employee_id", nameField: "sales_engineering_name", label: "SE" },
  { field: "sales_engineering_head_employee_id", nameField: "sales_engineering_head_name", label: "SE Head" },
  { field: "product_specialist_employee_id", nameField: "product_specialist_name", label: "Product Specialist" },
  { field: "product_specialist_head_employee_id", nameField: "product_specialist_head_name", label: "PS Head" },
  { field: "solution_manager_employee_id", nameField: "solution_manager_name", label: "Solution Manager" },
  { field: "solution_manager_head_employee_id", nameField: "solution_manager_head_name", label: "SM Head" },
  { field: "channel_sales_employee_id", nameField: "channel_sales_name", label: "Channel Sales" },
];

interface EligibleDeal {
  id: string;
  project_id: string;
  customer_name: string | null;
  new_software_booking_arr_usd: number | null;
  month_year: string;
  [key: string]: any;
}

interface TeamMember {
  employee_id: string;
  name: string;
  role: string;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getDealAllocationStatus(
  dealId: string,
  allocations: DealTeamSpiffAllocation[],
  poolAmount: number
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  const dealAllocs = allocations.filter(a => a.deal_id === dealId);
  if (dealAllocs.length === 0) return { label: "Unallocated", variant: "outline" };
  const hasApproved = dealAllocs.some(a => a.status === "approved");
  if (hasApproved) return { label: "Approved", variant: "default" };
  const total = dealAllocs.reduce((s, a) => s + a.allocated_amount_usd, 0);
  if (Math.abs(total - poolAmount) < 0.01) return { label: "Fully Allocated", variant: "secondary" };
  return { label: "Partial", variant: "destructive" };
}

export function DealTeamSpiffManager() {
  const { selectedYear } = useFiscalYear();
  const { canPerformAction } = usePermissions();
  const canAllocate = canPerformAction("action:allocate_deal_spiff");
  const canApprove = canPerformAction("action:approve_deal_spiff");
  const { data: config, isLoading: configLoading } = useDealTeamSpiffConfig();
  const { data: allAllocations, isLoading: allocsLoading } = useDealTeamSpiffAllocations();
  const updateConfig = useUpdateDealTeamSpiffConfig();
  const upsertAllocations = useUpsertDealTeamSpiffAllocations();
  const approveAllocations = useApproveDealTeamSpiffAllocations();
  const rejectAllocations = useRejectDealTeamSpiffAllocations();

  const [selectedDeal, setSelectedDeal] = useState<EligibleDeal | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const poolAmount = config?.spiff_pool_amount_usd ?? 10000;
  const minArr = config?.min_deal_arr_usd ?? 400000;

  // Fetch eligible deals
  const { data: eligibleDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ["eligible_deals_for_team_spiff", selectedYear, minArr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .gte("new_software_booking_arr_usd", minArr)
        .gte("month_year", `${selectedYear}-01-01`)
        .lte("month_year", `${selectedYear}-12-31`)
        .order("month_year", { ascending: false });
      if (error) throw error;
      return (data || []) as EligibleDeal[];
    },
    enabled: !!config,
  });

  // Get unique months for filter
  const months = useMemo(() => {
    if (!eligibleDeals) return [];
    return [...new Set(eligibleDeals.map(d => d.month_year.substring(0, 7)))].sort().reverse();
  }, [eligibleDeals]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (!eligibleDeals || !allAllocations) return [];
    return eligibleDeals.filter(deal => {
      if (monthFilter !== "all" && !deal.month_year.startsWith(monthFilter)) return false;
      if (statusFilter !== "all") {
        const status = getDealAllocationStatus(deal.id, allAllocations, poolAmount);
        if (statusFilter === "unallocated" && status.label !== "Unallocated") return false;
        if (statusFilter === "allocated" && status.label !== "Fully Allocated" && status.label !== "Partial") return false;
        if (statusFilter === "approved" && status.label !== "Approved") return false;
      }
      return true;
    });
  }, [eligibleDeals, allAllocations, monthFilter, statusFilter, poolAmount]);

  const isLoading = configLoading || allocsLoading || dealsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Deal Team SPIFFs</h2>
          <p className="text-sm text-muted-foreground">
            Allocate {formatCurrency(poolAmount)} pool for eligible deals (ARR ≥ {formatCurrency(minArr)})
          </p>
        </div>
        {canAllocate && (
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Eligible Deals</p>
                <p className="text-2xl font-semibold">{eligibleDeals?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-semibold">
                  {eligibleDeals?.filter(d => {
                    const s = getDealAllocationStatus(d.id, allAllocations || [], poolAmount);
                    return s.label === "Fully Allocated";
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-semibold">
                  {eligibleDeals?.filter(d => {
                    const s = getDealAllocationStatus(d.id, allAllocations || [], poolAmount);
                    return s.label === "Approved";
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="unallocated">Unallocated</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Eligible Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligible Deals</CardTitle>
          <CardDescription>Deals with ARR ≥ {formatCurrency(minArr)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">ARR (USD)</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals && filteredDeals.length > 0 ? (
                filteredDeals.map(deal => {
                  const status = getDealAllocationStatus(deal.id, allAllocations || [], poolAmount);
                  return (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium">{deal.project_id}</TableCell>
                      <TableCell>{deal.customer_name || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(deal.new_software_booking_arr_usd || 0)}
                      </TableCell>
                      <TableCell>{deal.month_year.substring(0, 7)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDeal(deal)}
                          >
                            {status.label === "Approved" || !canAllocate ? "View" : "Allocate"}
                          </Button>
                          {canApprove && status.label === "Fully Allocated" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approveAllocations.mutate(deal.id)}
                                disabled={approveAllocations.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectAllocations.mutate(deal.id)}
                                disabled={rejectAllocations.isPending}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No eligible deals found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Allocation Dialog */}
      {selectedDeal && (
        <AllocationDialog
          deal={selectedDeal}
          poolAmount={poolAmount}
          existingAllocations={(allAllocations || []).filter(a => a.deal_id === selectedDeal.id)}
          onClose={() => setSelectedDeal(null)}
          readOnly={!canAllocate}
          onSave={(items) => {
            upsertAllocations.mutate({
              deal_id: selectedDeal.id,
              items,
              payout_month: selectedDeal.month_year.substring(0, 7) + "-01",
              status: "pending",
            }, {
              onSuccess: () => setSelectedDeal(null),
            });
          }}
          isSaving={upsertAllocations.isPending}
        />
      )}

      {/* Config Dialog */}
      {showConfig && config && (
        <ConfigDialog
          config={config}
          onClose={() => setShowConfig(false)}
          onSave={(values) => {
            updateConfig.mutate({ id: config.id, ...values }, {
              onSuccess: () => setShowConfig(false),
            });
          }}
          isSaving={updateConfig.isPending}
        />
      )}
    </div>
  );
}

// ---- Allocation Dialog ----

function AllocationDialog({
  deal,
  poolAmount,
  existingAllocations,
  onClose,
  readOnly,
  onSave,
  isSaving,
}: {
  deal: EligibleDeal;
  poolAmount: number;
  existingAllocations: DealTeamSpiffAllocation[];
  onClose: () => void;
  readOnly?: boolean;
  onSave: (items: { employee_id: string; allocated_amount_usd: number; allocated_amount_local: number; local_currency: string; exchange_rate_used: number; notes?: string }[]) => void;
  isSaving: boolean;
}) {
  const isApproved = existingAllocations.some(a => a.status === "approved");
  const isReadOnly = readOnly || isApproved;
  const { data: profiles } = useProfiles();

  // Manual team members list — initialized from existing allocations
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    return existingAllocations.map(a => {
      const profile = profiles?.find(p => p.employee_id === a.employee_id);
      return {
        employee_id: a.employee_id,
        name: profile?.full_name || a.employee_id,
        role: "",
      };
    });
  });

  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    existingAllocations.forEach(a => {
      init[a.employee_id] = a.allocated_amount_usd;
    });
    return init;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    existingAllocations.forEach(a => {
      init[a.employee_id] = a.notes ?? "";
    });
    return init;
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // Build dropdown options: all employees minus already-added ones
  const employeeOptions = useMemo(() => {
    if (!profiles) return [];
    const addedIds = new Set(teamMembers.map(m => m.employee_id));
    return profiles
      .filter(p => p.employee_id && !addedIds.has(p.employee_id))
      .map(p => ({ value: p.employee_id!, label: `${p.full_name} (${p.employee_id})` }));
  }, [profiles, teamMembers]);

  const handleAddMember = useCallback(() => {
    if (!selectedEmployeeId || !profiles) return;
    const profile = profiles.find(p => p.employee_id === selectedEmployeeId);
    if (!profile) return;
    setTeamMembers(prev => [...prev, {
      employee_id: selectedEmployeeId,
      name: profile.full_name,
      role: profile.designation || "",
    }]);
    setAmounts(prev => ({ ...prev, [selectedEmployeeId]: 0 }));
    setNotes(prev => ({ ...prev, [selectedEmployeeId]: "" }));
    setSelectedEmployeeId("");
  }, [selectedEmployeeId, profiles]);

  const handleRemoveMember = useCallback((empId: string) => {
    setTeamMembers(prev => prev.filter(m => m.employee_id !== empId));
    setAmounts(prev => { const n = { ...prev }; delete n[empId]; return n; });
    setNotes(prev => { const n = { ...prev }; delete n[empId]; return n; });
  }, []);

  const totalAllocated = Object.values(amounts).reduce((s, v) => s + v, 0);
  const remaining = poolAmount - totalAllocated;
  const isValid = Math.abs(remaining) < 0.01 && teamMembers.length > 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deal Team SPIFF Allocation</DialogTitle>
          <DialogDescription>
            {deal.customer_name || deal.project_id} — ARR: {formatCurrency(deal.new_software_booking_arr_usd || 0)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pool info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm font-medium">Pool: {formatCurrency(poolAmount)}</span>
            <span className={`text-sm font-medium ${isValid ? "text-emerald-600" : remaining < 0 ? "text-destructive" : "text-amber-600"}`}>
              Remaining: {formatCurrency(remaining)}
            </span>
          </div>

          {/* Add employee row */}
          {!isReadOnly && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Add Team Member</label>
                <SearchableSelect
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  options={employeeOptions}
                  placeholder="Search employee..."
                  searchPlaceholder="Type name or ID..."
                  emptyMessage="No employees found."
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddMember}
                disabled={!selectedEmployeeId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          )}

          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No team members added yet. Use the search above to add employees.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="text-right w-[140px]">Amount (USD)</TableHead>
                  <TableHead className="w-[200px]">Notes</TableHead>
                  {!isReadOnly && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map(member => (
                  <TableRow key={member.employee_id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-right">
                      {isReadOnly ? (
                        formatCurrency(amounts[member.employee_id] || 0)
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={poolAmount}
                          value={amounts[member.employee_id] || ""}
                          onChange={(e) =>
                            setAmounts(prev => ({
                              ...prev,
                              [member.employee_id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-[120px] text-right ml-auto"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {isReadOnly ? (
                        <span className="text-sm text-muted-foreground">{notes[member.employee_id] || "-"}</span>
                      ) : (
                        <Input
                          placeholder="Optional note"
                          value={notes[member.employee_id] || ""}
                          onChange={(e) =>
                            setNotes(prev => ({ ...prev, [member.employee_id]: e.target.value }))
                          }
                          className="text-sm"
                        />
                      )}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.employee_id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isReadOnly && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={!isValid || isSaving}
                onClick={() => {
                  const items = teamMembers.map(m => ({
                    employee_id: m.employee_id,
                    allocated_amount_usd: amounts[m.employee_id] || 0,
                    allocated_amount_local: amounts[m.employee_id] || 0,
                    local_currency: "USD",
                    exchange_rate_used: 1,
                    notes: notes[m.employee_id] || undefined,
                  }));
                  onSave(items);
                }}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Save Allocation
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Config Dialog ----

function ConfigDialog({
  config,
  onClose,
  onSave,
  isSaving,
}: {
  config: { spiff_pool_amount_usd: number; min_deal_arr_usd: number; is_active: boolean };
  onClose: () => void;
  onSave: (values: { spiff_pool_amount_usd: number; min_deal_arr_usd: number; is_active: boolean }) => void;
  isSaving: boolean;
}) {
  const [pool, setPool] = useState(config.spiff_pool_amount_usd);
  const [minArr, setMinArr] = useState(config.min_deal_arr_usd);
  const [active, setActive] = useState(config.is_active);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deal Team SPIFF Settings</DialogTitle>
          <DialogDescription>Configure the pool amount and eligibility threshold.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Pool Amount (USD)</label>
            <Input
              type="number"
              value={pool}
              onChange={(e) => setPool(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Min Deal ARR Threshold (USD)</label>
            <Input
              type="number"
              value={minArr}
              onChange={(e) => setMinArr(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={isSaving}
              onClick={() => onSave({ spiff_pool_amount_usd: pool, min_deal_arr_usd: minArr, is_active: active })}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
