import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { usePayoutMetricDetails, EmployeeWorkings, PayoutMetricDetailRow } from "@/hooks/usePayoutMetricDetails";

interface PayoutRunWorkingsProps {
  payoutRunId: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return value < 0 ? `-$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `$${formatted}`;
};

const formatPct = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(4)}%`;
};

const formatMultiplier = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return '-';
  return `${value.toFixed(2)}x`;
};

const formatOtePct = (allocated: number | null | undefined, targetBonus: number | null | undefined) => {
  if (!allocated || !targetBonus || targetBonus === 0) return '-';
  return `${((allocated / targetBonus) * 100).toFixed(2)}%`;
};

// Group ordering: known groups in display order, unknown types fall into "Other"
const GROUP_CONFIG: { key: string; label: string; types: string[] }[] = [
  { key: 'vp', label: 'Variable Pay', types: ['variable_pay'] },
  { key: 'comm', label: 'Commissions', types: ['commission'] },
  { key: 'additional', label: 'Additional Pay', types: ['nrr', 'spiff', 'deal_team_spiff'] },
  { key: 'releases', label: 'Releases & Adjustments', types: ['collection_release', 'year_end_release', 'clawback'] },
];

const ALL_KNOWN_TYPES = GROUP_CONFIG.flatMap(g => g.types);

function groupRows(details: PayoutMetricDetailRow[]) {
  const groups: { key: string; label: string; rows: PayoutMetricDetailRow[] }[] = [];

  for (const g of GROUP_CONFIG) {
    const rows = details.filter(d => g.types.includes(d.component_type));
    if (rows.length > 0) groups.push({ key: g.key, label: g.label, rows });
  }

  // Catch-all for any new component_types not in the known list
  const otherRows = details.filter(d => !ALL_KNOWN_TYPES.includes(d.component_type));
  if (otherRows.length > 0) {
    groups.push({ key: 'other', label: 'Other', rows: otherRows });
  }

  return groups;
}

const COL_COUNT = 12;

function SubtotalRow({ label, rows }: { label: string; rows: PayoutMetricDetailRow[] }) {
  return (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell>{label} Subtotal</TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.allocated_ote_usd, 0))}</TableCell>
      <TableCell />
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.ytd_eligible_usd, 0))}</TableCell>
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.prior_paid_usd, 0))}</TableCell>
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.this_month_usd, 0))}</TableCell>
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.booking_usd, 0))}</TableCell>
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.collection_usd, 0))}</TableCell>
      <TableCell className="text-right">{formatCurrency(rows.reduce((s, d) => s + d.year_end_usd, 0))}</TableCell>
    </TableRow>
  );
}

function EmployeeWorkingsCard({ emp }: { emp: EmployeeWorkings }) {
  const groups = groupRows(emp.allDetails);
  const grandTotal = emp.allDetails.reduce((s, d) => s + d.this_month_usd, 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="text-right">YTD Actuals</TableHead>
            <TableHead className="text-right">Ach %</TableHead>
            <TableHead className="text-right">OTE %</TableHead>
            <TableHead className="text-right">Allocated OTE</TableHead>
            <TableHead className="text-right">Multiplier</TableHead>
            <TableHead className="text-right">YTD Eligible</TableHead>
            <TableHead className="text-right">Prior Paid</TableHead>
            <TableHead className="text-right">This Month</TableHead>
            <TableHead className="text-right">Booking</TableHead>
            <TableHead className="text-right">Collection</TableHead>
            <TableHead className="text-right">Year-End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <>
              {/* Group sub-header */}
              <TableRow key={`header-${group.key}`} className="bg-muted/30">
                <TableCell colSpan={COL_COUNT + 1} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                  {group.label}
                </TableCell>
              </TableRow>

              {/* Detail rows */}
              {group.rows.map((d) => (
                <TableRow
                  key={d.id}
                  className={d.component_type === 'clawback' ? 'text-destructive' : ''}
                >
                  <TableCell className="font-medium pl-6">{d.metric_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.target_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.actual_usd)}</TableCell>
                  <TableCell className="text-right">{formatPct(d.achievement_pct)}</TableCell>
                  <TableCell className="text-right">{formatOtePct(d.allocated_ote_usd, d.target_bonus_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.allocated_ote_usd)}</TableCell>
                  <TableCell className="text-right">{formatMultiplier(d.multiplier)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.ytd_eligible_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.prior_paid_usd)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
                </TableRow>
              ))}

              {/* Subtotal row if group has multiple rows */}
              {group.rows.length > 1 && (
                <SubtotalRow key={`sub-${group.key}`} label={group.label} rows={group.rows} />
              )}
            </>
          ))}

          {/* Grand Total */}
          <TableRow className="bg-muted/50 font-semibold border-t-2">
            <TableCell>Grand Total</TableCell>
            <TableCell colSpan={8} />
            <TableCell className="text-right text-emerald-700 dark:text-emerald-400">
              {formatCurrency(grandTotal)}
            </TableCell>
            <TableCell className="text-right">{formatCurrency(emp.allDetails.reduce((s, d) => s + d.booking_usd, 0))}</TableCell>
            <TableCell className="text-right">{formatCurrency(emp.allDetails.reduce((s, d) => s + d.collection_usd, 0))}</TableCell>
            <TableCell className="text-right">{formatCurrency(emp.allDetails.reduce((s, d) => s + d.year_end_usd, 0))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function PayoutRunWorkings({ payoutRunId }: PayoutRunWorkingsProps) {
  const { data: employeeWorkings, isLoading } = usePayoutMetricDetails(payoutRunId);
  const [search, setSearch] = useState("");
  
  const filtered = employeeWorkings?.filter(emp =>
    !search || 
    emp.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!filtered || filtered.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No detailed workings available. Run the calculation to generate metric-level details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Accordion type="multiple" className="space-y-2">
        {filtered.map((emp) => (
          <AccordionItem key={emp.employeeId} value={emp.employeeId} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div>
                  <span className="font-semibold">{emp.employeeName}</span>
                  <span className="text-sm text-muted-foreground ml-2">({emp.employeeCode})</span>
                </div>
                {emp.planName && (
                  <Badge variant="outline" className="text-xs">{emp.planName}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{emp.localCurrency}</Badge>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 ml-auto mr-4">
                  {formatCurrency(emp.allDetails.reduce((s, d) => s + d.this_month_usd, 0))}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <EmployeeWorkingsCard emp={emp} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
