import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PayoutRunWorkingsSummary } from "./PayoutRunWorkingsSummary";
import { PayoutRunDealWorkings } from "./PayoutRunDealWorkings";

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

const formatCommissionRate = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(2)}%`;
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

  const otherRows = details.filter(d => !ALL_KNOWN_TYPES.includes(d.component_type));
  if (otherRows.length > 0) {
    groups.push({ key: 'other', label: 'Other', rows: otherRows });
  }

  return groups;
}

// Determine column layout based on the dominant component type in a group
type ColumnLayout = 'variable_pay' | 'commission' | 'spiff';

function getColumnLayout(groupKey: string): ColumnLayout {
  if (groupKey === 'comm') return 'commission';
  if (groupKey === 'additional') return 'spiff'; // SPIFFs/NRR - we'll handle NRR specially
  return 'variable_pay';
}

function getRowLayout(componentType: string): ColumnLayout {
  if (componentType === 'commission') return 'commission';
  if (componentType === 'spiff' || componentType === 'deal_team_spiff') return 'spiff';
  return 'variable_pay';
}

// Column count per layout (excluding Metric column)
const LAYOUT_COL_COUNT: Record<ColumnLayout, number> = {
  variable_pay: 12, // Target, Actuals, Ach%, OTE%, Allocated OTE, Multiplier, YTD, Prior, Incr, Booking, Collection, YearEnd
  commission: 8,    // Commission%, Actuals, YTD, Prior, Incr, Booking, Collection, YearEnd
  spiff: 9,         // OTE%, Allocated OTE, Actuals, YTD, Prior, Incr, Booking, Collection, YearEnd
};

function GroupHeader({ layout }: { layout: ColumnLayout }) {
  if (layout === 'commission') {
    return (
      <TableRow>
        <TableHead>Metric</TableHead>
        <TableHead className="text-right">Commission %</TableHead>
        <TableHead className="text-right">Actuals (TCV)</TableHead>
        <TableHead className="text-right">YTD Eligible</TableHead>
        <TableHead className="text-right">Eligible Till Last Month</TableHead>
        <TableHead className="text-right">Incremental Eligible</TableHead>
        <TableHead className="text-right">Upon Booking</TableHead>
        <TableHead className="text-right">Upon Collection</TableHead>
        <TableHead className="text-right">At Year End</TableHead>
      </TableRow>
    );
  }
  if (layout === 'spiff') {
    return (
      <TableRow>
        <TableHead>Metric</TableHead>
        <TableHead className="text-right">OTE %</TableHead>
        <TableHead className="text-right">Allocated OTE</TableHead>
        <TableHead className="text-right">Actuals</TableHead>
        <TableHead className="text-right">YTD Eligible</TableHead>
        <TableHead className="text-right">Eligible Till Last Month</TableHead>
        <TableHead className="text-right">Incremental Eligible</TableHead>
        <TableHead className="text-right">Upon Booking</TableHead>
        <TableHead className="text-right">Upon Collection</TableHead>
        <TableHead className="text-right">At Year End</TableHead>
      </TableRow>
    );
  }
  return (
    <TableRow>
      <TableHead>Metric</TableHead>
      <TableHead className="text-right">Target</TableHead>
      <TableHead className="text-right">YTD Actuals</TableHead>
      <TableHead className="text-right">Ach %</TableHead>
      <TableHead className="text-right">OTE %</TableHead>
      <TableHead className="text-right">Allocated OTE</TableHead>
      <TableHead className="text-right">Multiplier</TableHead>
      <TableHead className="text-right">YTD Eligible</TableHead>
      <TableHead className="text-right">Eligible Till Last Month</TableHead>
      <TableHead className="text-right">Incremental Eligible</TableHead>
      <TableHead className="text-right">Upon Booking</TableHead>
      <TableHead className="text-right">Upon Collection</TableHead>
      <TableHead className="text-right">At Year End</TableHead>
    </TableRow>
  );
}

function DetailRow({ d }: { d: PayoutMetricDetailRow }) {
  const layout = getRowLayout(d.component_type);
  const cls = d.component_type === 'clawback' ? 'text-destructive' : '';

  if (layout === 'commission') {
    return (
      <TableRow className={cls}>
        <TableCell className="font-medium pl-6">{d.metric_name}</TableCell>
        <TableCell className="text-right">{formatCommissionRate(d.commission_rate_pct)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.actual_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.ytd_eligible_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.prior_paid_usd)}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
      </TableRow>
    );
  }

  if (layout === 'spiff') {
    return (
      <TableRow className={cls}>
        <TableCell className="font-medium pl-6">{d.metric_name}</TableCell>
        <TableCell className="text-right">{formatOtePct(d.allocated_ote_usd, d.target_bonus_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.allocated_ote_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.actual_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.ytd_eligible_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.prior_paid_usd)}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
      </TableRow>
    );
  }

  // variable_pay / nrr / default
  return (
    <TableRow className={cls}>
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
  );
}

function SubtotalRow({ label, rows, layout }: { label: string; rows: PayoutMetricDetailRow[]; layout: ColumnLayout }) {
  const colCount = LAYOUT_COL_COUNT[layout];
  // Payout columns are always the last 6
  const emptyBefore = colCount - 6;

  return (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell>{label} Subtotal</TableCell>
      {Array.from({ length: emptyBefore }, (_, i) => <TableCell key={i} />)}
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

  // Compute grand total derivation
  const totalUponBooking = emp.allDetails.reduce((s, d) => s + d.booking_usd, 0);
  const totalUponCollection = emp.allDetails.reduce((s, d) => s + d.collection_usd, 0);
  const totalAtYearEnd = emp.allDetails.reduce((s, d) => s + d.year_end_usd, 0);
  
  // Collection releases, year-end releases, and clawback recovery come from specific component_type rows
  const collectionReleases = emp.allDetails
    .filter(d => d.component_type === 'collection_release')
    .reduce((s, d) => s + d.this_month_usd, 0);
  const yearEndReleases = emp.allDetails
    .filter(d => d.component_type === 'year_end_release')
    .reduce((s, d) => s + d.this_month_usd, 0);
  const clawbackRecovery = emp.allDetails
    .filter(d => d.component_type === 'clawback')
    .reduce((s, d) => s + d.this_month_usd, 0);
  
  const currentMonthPayable = totalUponBooking + collectionReleases + yearEndReleases - Math.abs(clawbackRecovery);

  return (
    <div className="space-y-4">
      {/* Total Variable OTE header */}
      <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-sm">
        <span className="text-muted-foreground">Total Variable OTE:</span>
        <span className="font-semibold">{formatCurrency(emp.targetBonusUsd)}</span>
      </div>

      {groups.map((group) => {
        const layout = getGroupLayout(group);
        return (
          <div key={group.key} className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead colSpan={LAYOUT_COL_COUNT[layout] + 1} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                    {group.label}
                  </TableHead>
                </TableRow>
                <GroupHeader layout={layout} />
              </TableHeader>
              <TableBody>
                {group.rows.map((d) => (
                  <DetailRow key={d.id} d={d} />
                ))}
                {group.rows.length > 1 && (
                  <SubtotalRow label={group.label} rows={group.rows} layout={layout} />
                )}
              </TableBody>
            </Table>
          </div>
        );
      })}

      {/* Grand Total Derivation */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead colSpan={2} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                Payout Derivation
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Total Upon Booking</TableCell>
              <TableCell className="text-right">{formatCurrency(totalUponBooking)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Total Upon Collection (Held)</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(totalUponCollection)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Total At Year End (Held)</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(totalAtYearEnd)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Collection Releases</TableCell>
              <TableCell className="text-right">{formatCurrency(collectionReleases)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Year-End Releases</TableCell>
              <TableCell className="text-right">{formatCurrency(yearEndReleases)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-destructive">Clawback Recovery</TableCell>
              <TableCell className="text-right text-destructive">{formatCurrency(clawbackRecovery !== 0 ? -Math.abs(clawbackRecovery) : 0)}</TableCell>
            </TableRow>
            <TableRow className="bg-muted/50 font-semibold border-t-2">
              <TableCell className="font-bold">Current Month Payable</TableCell>
              <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(currentMonthPayable)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getGroupLayout(group: { key: string; rows: PayoutMetricDetailRow[] }): ColumnLayout {
  // For 'additional' group, NRR uses variable_pay layout but spiff uses spiff layout
  // Use the dominant type in the group
  if (group.key === 'comm') return 'commission';
  if (group.key === 'additional') {
    // If any NRR rows, use variable_pay; if only spiffs, use spiff
    const hasNrr = group.rows.some(r => r.component_type === 'nrr');
    if (hasNrr) return 'variable_pay';
    return 'spiff';
  }
  return 'variable_pay';
}

export function PayoutRunWorkings({ payoutRunId }: PayoutRunWorkingsProps) {
  const { data: employeeWorkings, isLoading } = usePayoutMetricDetails(payoutRunId);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"summary" | "detail" | "deals">("summary");
  
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
      <div className="flex items-center gap-4">
        <Tabs value={view} onValueChange={(v) => setView(v as "summary" | "detail" | "deals")}>
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="detail">Detail</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {view === "summary" ? (
        <PayoutRunWorkingsSummary employees={filtered} />
      ) : view === "deals" ? (
        <PayoutRunDealWorkings payoutRunId={payoutRunId} />
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((emp) => (
            <AccordionItem key={emp.employeeId} value={emp.employeeId} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left flex-wrap">
                  <div>
                    <span className="font-semibold">{emp.employeeName}</span>
                    <span className="text-sm text-muted-foreground ml-2">({emp.employeeCode})</span>
                  </div>
                  {emp.planName && (
                    <Badge variant="outline" className="text-xs">{emp.planName}</Badge>
                  )}
                  <Badge variant={emp.isActive ? "default" : "secondary"} className="text-xs">
                    {emp.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {emp.businessUnit && (
                    <span className="text-xs text-muted-foreground">BU: {emp.businessUnit}</span>
                  )}
                  {emp.dateOfHire && (
                    <span className="text-xs text-muted-foreground">DOJ: {emp.dateOfHire}</span>
                  )}
                  {emp.departureDate && (
                    <span className="text-xs text-muted-foreground">LWD: {emp.departureDate}</span>
                  )}
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
      )}
    </div>
  );
}