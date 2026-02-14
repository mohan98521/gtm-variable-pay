import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calculator, CheckCircle, Lock, CreditCard, Clock } from "lucide-react";
import {
  useFnfSettlement,
  useFnfSettlementLines,
  useCalculateTranche1,
  useCalculateTranche2,
  useUpdateTrancheStatus,
  FnFSettlement,
} from "@/hooks/useFnfSettlements";

interface Props {
  settlementId: string;
  onBack: () => void;
  employeeNameMap: Map<string, string>;
}

const STATUS_FLOW = ['draft', 'review', 'approved', 'finalized', 'paid'] as const;

const LINE_TYPE_LABELS: Record<string, string> = {
  year_end_release: "Year-End Release",
  vp_settlement: "VP Settlement",
  nrr_settlement: "NRR Settlement",
  spiff_settlement: "SPIFF Settlement",
  commission_settlement: "Commission Settlement",
  clawback_deduction: "Clawback Deduction",
  clawback_carryforward: "Clawback Carry-forward",
  clawback_writeoff: "Clawback Write-off",
  collection_release: "Collection Release",
  collection_forfeit: "Collection Forfeit",
};

function getNextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current as any);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function getActionLabel(nextStatus: string): string {
  switch (nextStatus) {
    case 'review': return 'Submit for Review';
    case 'approved': return 'Approve';
    case 'finalized': return 'Finalize';
    case 'paid': return 'Mark as Paid';
    default: return nextStatus;
  }
}

function getActionIcon(nextStatus: string) {
  switch (nextStatus) {
    case 'approved': return CheckCircle;
    case 'finalized': return Lock;
    case 'paid': return CreditCard;
    default: return CheckCircle;
  }
}

export function FnFSettlementDetail({ settlementId, onBack, employeeNameMap }: Props) {
  const { data: settlement, isLoading } = useFnfSettlement(settlementId);
  const { data: lines = [] } = useFnfSettlementLines(settlementId);
  const calcT1 = useCalculateTranche1();
  const calcT2 = useCalculateTranche2();
  const updateStatus = useUpdateTrancheStatus();

  const tranche1Lines = useMemo(() => lines.filter((l) => l.tranche === 1), [lines]);
  const tranche2Lines = useMemo(() => lines.filter((l) => l.tranche === 2), [lines]);

  const isT2Eligible = useMemo(() => {
    if (!settlement?.tranche2_eligible_date) return false;
    return new Date() >= new Date(settlement.tranche2_eligible_date);
  }, [settlement]);

  if (isLoading || !settlement) {
    return <div className="text-center py-8 text-muted-foreground">Loading…</div>;
  }

  const empName = employeeNameMap.get(settlement.employee_id) || settlement.employee_id;
  const t1Next = getNextStatus(settlement.tranche1_status);
  const t2Next = settlement.tranche2_status !== 'pending' ? getNextStatus(settlement.tranche2_status) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">F&F Settlement — {empName}</h2>
          <p className="text-sm text-muted-foreground">
            Departure: {settlement.departure_date} · FY {settlement.fiscal_year} · Grace: {settlement.collection_grace_days} days
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tranche 1 Total</CardDescription>
            <CardTitle className="text-2xl font-mono">
              ${(settlement.tranche1_total_usd || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{settlement.tranche1_status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tranche 2 Total</CardDescription>
            <CardTitle className="text-2xl font-mono">
              ${(settlement.tranche2_total_usd || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{settlement.tranche2_status}</Badge>
            {!isT2Eligible && settlement.tranche2_eligible_date && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Eligible after {settlement.tranche2_eligible_date}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clawback Carry-forward</CardDescription>
            <CardTitle className="text-2xl font-mono">
              ${(settlement.clawback_carryforward_usd || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {settlement.clawback_carryforward_usd > 0
                ? "Will be deducted from Tranche 2"
                : "No carry-forward"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tranche 1 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tranche 1 — Immediate Settlement</CardTitle>
            <CardDescription>Year-end releases & clawback deductions</CardDescription>
          </div>
          <div className="flex gap-2">
            {settlement.tranche1_status === 'draft' && (
              <Button
                size="sm"
                onClick={() => calcT1.mutate(settlement)}
                disabled={calcT1.isPending}
              >
                <Calculator className="h-4 w-4 mr-1" />
                {calcT1.isPending ? "Calculating…" : "Calculate"}
              </Button>
            )}
            {t1Next && settlement.tranche1_status !== 'draft' && (
              <Button
                size="sm"
                onClick={() =>
                  updateStatus.mutate({
                    settlementId: settlement.id,
                    tranche: 1,
                    newStatus: t1Next,
                    employeeId: settlement.employee_id,
                  })
                }
                disabled={updateStatus.isPending}
              >
                {(() => { const Icon = getActionIcon(t1Next); return <Icon className="h-4 w-4 mr-1" />; })()}
                {getActionLabel(t1Next)}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <LinesTable lines={tranche1Lines} />
        </CardContent>
      </Card>

      {/* Tranche 2 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tranche 2 — Post-Grace Period</CardTitle>
            <CardDescription>
              Collection releases/forfeits after {settlement.collection_grace_days}-day grace period
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {settlement.tranche2_status === 'pending' && isT2Eligible && (
              <Button
                size="sm"
                onClick={() => calcT2.mutate(settlement)}
                disabled={calcT2.isPending}
              >
                <Calculator className="h-4 w-4 mr-1" />
                {calcT2.isPending ? "Calculating…" : "Calculate"}
              </Button>
            )}
            {settlement.tranche2_status === 'pending' && !isT2Eligible && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Available after {settlement.tranche2_eligible_date}
              </Badge>
            )}
            {t2Next && (
              <Button
                size="sm"
                onClick={() =>
                  updateStatus.mutate({
                    settlementId: settlement.id,
                    tranche: 2,
                    newStatus: t2Next,
                    employeeId: settlement.employee_id,
                  })
                }
                disabled={updateStatus.isPending}
              >
                {(() => { const Icon = getActionIcon(t2Next); return <Icon className="h-4 w-4 mr-1" />; })()}
                {getActionLabel(t2Next)}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tranche2Lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {settlement.tranche2_status === 'pending'
                ? "Tranche 2 has not been calculated yet"
                : "No line items"}
            </p>
          ) : (
            <LinesTable lines={tranche2Lines} />
          )}
        </CardContent>
      </Card>

      {settlement.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{settlement.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinesTable({ lines }: { lines: any[] }) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No line items yet — click Calculate to generate.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Payout Type</TableHead>
          <TableHead className="text-right">Amount (USD)</TableHead>
          <TableHead className="text-right">Amount (Local)</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line: any) => (
          <TableRow key={line.id}>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {LINE_TYPE_LABELS[line.line_type] || line.line_type}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">{line.payout_type || '—'}</TableCell>
            <TableCell className={`text-right font-mono ${line.amount_usd < 0 ? 'text-destructive' : ''}`}>
              {line.amount_usd < 0 ? '-' : ''}${Math.abs(line.amount_usd).toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {line.amount_local ? `${line.amount_local.toLocaleString()}` : '—'}
            </TableCell>
            <TableCell className="text-sm">{line.local_currency}</TableCell>
            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
              {line.notes || '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
