import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFnfSettlements, useCreateFnfSettlement, FnFSettlement } from "@/hooks/useFnfSettlements";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { FnFSettlementDetail } from "./FnFSettlementDetail";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-100 text-yellow-800",
  review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  finalized: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
};

/** Fetch employees from the employees table (not profiles) */
function useEmployeesForFnf() {
  return useQuery({
    queryKey: ["employees_for_fnf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, is_active, departure_date")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function FnFSettlementManagement() {
  const { selectedYear } = useFiscalYear();
  const { data: settlements = [], isLoading } = useFnfSettlements(selectedYear);
  const { data: employees = [] } = useEmployeesForFnf();
  const createMutation = useCreateFnfSettlement();

  const [showInitiate, setShowInitiate] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    collection_grace_days: 90,
    notes: "",
  });

  // Only inactive employees with departure_date (from employees table)
  const departedEmployees = useMemo(
    () => employees.filter((e) => !e.is_active && e.departure_date),
    [employees]
  );

  // Employees already having a settlement
  const existingEmployeeIds = useMemo(
    () => new Set(settlements.map((s) => s.employee_id)),
    [settlements]
  );

  const eligibleEmployees = useMemo(
    () => departedEmployees.filter((e) => !existingEmployeeIds.has(e.id)),
    [departedEmployees, existingEmployeeIds]
  );

  const selectedEmp = useMemo(
    () => departedEmployees.find((e) => e.id === form.employee_id),
    [departedEmployees, form.employee_id]
  );

  const employeeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => map.set(e.id, e.full_name));
    return map;
  }, [employees]);

  const handleInitiate = async () => {
    if (!selectedEmp) return;
    await createMutation.mutateAsync({
      employee_id: selectedEmp.id,
      departure_date: selectedEmp.departure_date!,
      fiscal_year: selectedYear,
      collection_grace_days: form.collection_grace_days,
      notes: form.notes || undefined,
    });
    setShowInitiate(false);
    setForm({ employee_id: "", collection_grace_days: 90, notes: "" });
  };

  if (selectedSettlement) {
    return (
      <FnFSettlementDetail
        settlementId={selectedSettlement}
        onBack={() => setSelectedSettlement(null)}
        employeeNameMap={employeeNameMap}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">F&F Settlements</h2>
          <p className="text-sm text-muted-foreground">
            Full & Final settlements for departed employees
          </p>
        </div>
        <Button onClick={() => setShowInitiate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Initiate F&F
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Departure Date</TableHead>
                <TableHead>Tranche 1</TableHead>
                <TableHead className="text-right">T1 Amount</TableHead>
                <TableHead>Tranche 2</TableHead>
                <TableHead className="text-right">T2 Amount</TableHead>
                <TableHead>T2 Eligible</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No F&F settlements found for FY {selectedYear}
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedSettlement(s.id)}>
                    <TableCell className="font-medium">
                      {employeeNameMap.get(s.employee_id) || s.employee_id}
                    </TableCell>
                    <TableCell>{s.departure_date}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[s.tranche1_status] || ""} variant="secondary">
                        {s.tranche1_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${(s.tranche1_total_usd || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[s.tranche2_status] || ""} variant="secondary">
                        {s.tranche2_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${(s.tranche2_total_usd || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.tranche2_eligible_date || '—'}
                    </TableCell>
                    <TableCell>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Initiate Dialog */}
      <Dialog open={showInitiate} onOpenChange={setShowInitiate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate F&F Settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Departed Employee</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmp && (
              <div className="text-sm text-muted-foreground">
                Departure Date: <strong>{selectedEmp.departure_date}</strong>
              </div>
            )}

            <div>
              <Label>Collection Grace Period (days)</Label>
              <Input
                type="number"
                value={form.collection_grace_days}
                onChange={(e) => setForm((f) => ({ ...f, collection_grace_days: Number(e.target.value) || 90 }))}
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiate(false)}>Cancel</Button>
            <Button onClick={handleInitiate} disabled={!form.employee_id || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Initiate F&F"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
