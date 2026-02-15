import { EmployeeWorkings, PayoutMetricDetailRow } from "@/hooks/usePayoutMetricDetails";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GROUP_ORDER: Record<string, number> = {
  variable_pay: 0,
  commission: 1,
  nrr: 2,
  spiff: 3,
  deal_team_spiff: 4,
  collection_release: 5,
  year_end_release: 6,
  clawback: 7,
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

const formatPct = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(4)}%`;
};

const formatMultiplier = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return "-";
  return `${value.toFixed(2)}x`;
};

const formatOtePct = (allocated: number | null | undefined, targetBonus: number | null | undefined) => {
  if (!allocated || !targetBonus || targetBonus === 0) return "-";
  return `${((allocated / targetBonus) * 100).toFixed(2)}%`;
};

const formatCommissionRate = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}%`;
};

// Sub-column definitions per component type
type SubColDef = { key: string; label: string };

const VP_SUB_COLS: SubColDef[] = [
  { key: "tgt", label: "Target" },
  { key: "act", label: "Actuals" },
  { key: "ach", label: "Ach %" },
  { key: "ote", label: "OTE %" },
  { key: "alloc", label: "Allocated OTE" },
  { key: "mult", label: "Multiplier" },
  { key: "ytd", label: "YTD Eligible" },
  { key: "prior", label: "Elig Last Mo" },
  { key: "incr", label: "Incr Eligible" },
  { key: "bkg", label: "Booking" },
  { key: "coll", label: "Collection" },
  { key: "ye", label: "Year-End" },
];

const COMM_SUB_COLS: SubColDef[] = [
  { key: "rate", label: "Commission %" },
  { key: "act", label: "Actuals (TCV)" },
  { key: "ytd", label: "YTD Eligible" },
  { key: "prior", label: "Elig Last Mo" },
  { key: "incr", label: "Incr Eligible" },
  { key: "bkg", label: "Booking" },
  { key: "coll", label: "Collection" },
  { key: "ye", label: "Year-End" },
];

const SPIFF_SUB_COLS: SubColDef[] = [
  { key: "ote", label: "OTE %" },
  { key: "alloc", label: "Allocated OTE" },
  { key: "act", label: "Actuals" },
  { key: "ytd", label: "YTD Eligible" },
  { key: "prior", label: "Elig Last Mo" },
  { key: "incr", label: "Incr Eligible" },
  { key: "bkg", label: "Booking" },
  { key: "coll", label: "Collection" },
  { key: "ye", label: "Year-End" },
];

function getSubCols(componentType: string): SubColDef[] {
  if (componentType === 'commission') return COMM_SUB_COLS;
  if (componentType === 'spiff' || componentType === 'deal_team_spiff') return SPIFF_SUB_COLS;
  return VP_SUB_COLS;
}

interface MetricColumn {
  metricName: string;
  componentType: string;
  subCols: SubColDef[];
}

function discoverMetrics(employees: EmployeeWorkings[]): MetricColumn[] {
  const seen = new Map<string, MetricColumn>();
  for (const emp of employees) {
    for (const d of emp.allDetails) {
      const key = `${d.component_type}::${d.metric_name}`;
      if (!seen.has(key)) {
        seen.set(key, {
          metricName: d.metric_name,
          componentType: d.component_type,
          subCols: getSubCols(d.component_type),
        });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const ga = GROUP_ORDER[a.componentType] ?? 99;
    const gb = GROUP_ORDER[b.componentType] ?? 99;
    if (ga !== gb) return ga - gb;
    return a.metricName.localeCompare(b.metricName);
  });
}

function renderSubCells(d: PayoutMetricDetailRow | undefined, subCols: SubColDef[]) {
  if (!d) {
    return subCols.map((sc, i) => (
      <TableCell key={i} className="text-right text-muted-foreground">-</TableCell>
    ));
  }

  return subCols.map((sc) => {
    switch (sc.key) {
      case "tgt": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.target_usd)}</TableCell>;
      case "act": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.actual_usd)}</TableCell>;
      case "ach": return <TableCell key={sc.key} className="text-right">{formatPct(d.achievement_pct)}</TableCell>;
      case "ote": return <TableCell key={sc.key} className="text-right">{formatOtePct(d.allocated_ote_usd, d.target_bonus_usd)}</TableCell>;
      case "alloc": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.allocated_ote_usd)}</TableCell>;
      case "mult": return <TableCell key={sc.key} className="text-right">{formatMultiplier(d.multiplier)}</TableCell>;
      case "rate": return <TableCell key={sc.key} className="text-right">{formatCommissionRate(d.commission_rate_pct)}</TableCell>;
      case "ytd": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.ytd_eligible_usd)}</TableCell>;
      case "prior": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.prior_paid_usd)}</TableCell>;
      case "incr": return <TableCell key={sc.key} className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>;
      case "bkg": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.booking_usd)}</TableCell>;
      case "coll": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.collection_usd)}</TableCell>;
      case "ye": return <TableCell key={sc.key} className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>;
      default: return <TableCell key={sc.key} className="text-right">-</TableCell>;
    }
  });
}

interface Props {
  employees: EmployeeWorkings[];
}

export function PayoutRunWorkingsSummary({ employees }: Props) {
  const metrics = discoverMetrics(employees);

  // Build pivot: employeeId -> metricKey -> row
  const pivots = new Map<string, Map<string, PayoutMetricDetailRow>>();
  for (const emp of employees) {
    const m = new Map<string, PayoutMetricDetailRow>();
    for (const d of emp.allDetails) {
      m.set(`${d.component_type}::${d.metric_name}`, d);
    }
    pivots.set(emp.employeeId, m);
  }

  const GRAND_TOTAL_COLS = 4; // Incr Elig, Booking, Collection, Year-End

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {/* Top header row: metric group names */}
          <TableRow>
            <TableHead rowSpan={2} className="sticky left-0 bg-background z-10 min-w-[90px]">Emp Code</TableHead>
            <TableHead rowSpan={2} className="sticky left-[90px] bg-background z-10 min-w-[160px]">Emp Name</TableHead>
            <TableHead rowSpan={2} className="min-w-[100px]">Plan</TableHead>
            <TableHead rowSpan={2} className="min-w-[60px]">Ccy</TableHead>
            {metrics.map((mc) => (
              <TableHead
                key={`${mc.componentType}::${mc.metricName}`}
                colSpan={mc.subCols.length}
                className="text-center border-l bg-muted/30 text-xs uppercase tracking-wider"
              >
                {mc.metricName}
              </TableHead>
            ))}
            <TableHead colSpan={GRAND_TOTAL_COLS} className="text-center border-l bg-muted/50 font-semibold">
              Grand Total
            </TableHead>
          </TableRow>
          {/* Sub-header row: field labels */}
          <TableRow>
            {metrics.map((mc) =>
              mc.subCols.map((sc) => (
                <TableHead
                  key={`${mc.componentType}::${mc.metricName}::${sc.key}`}
                  className="text-right text-xs whitespace-nowrap min-w-[100px]"
                >
                  {sc.label}
                </TableHead>
              ))
            )}
            <TableHead className="text-right text-xs whitespace-nowrap min-w-[110px] border-l">Incr Eligible</TableHead>
            <TableHead className="text-right text-xs whitespace-nowrap min-w-[100px]">Booking</TableHead>
            <TableHead className="text-right text-xs whitespace-nowrap min-w-[100px]">Collection</TableHead>
            <TableHead className="text-right text-xs whitespace-nowrap min-w-[100px]">Year-End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => {
            const empPivot = pivots.get(emp.employeeId)!;
            const grandIncr = emp.allDetails.reduce((s, d) => s + d.this_month_usd, 0);
            const grandBkg = emp.allDetails.reduce((s, d) => s + d.booking_usd, 0);
            const grandColl = emp.allDetails.reduce((s, d) => s + d.collection_usd, 0);
            const grandYe = emp.allDetails.reduce((s, d) => s + d.year_end_usd, 0);

            return (
              <TableRow key={emp.employeeId}>
                <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">{emp.employeeCode}</TableCell>
                <TableCell className="sticky left-[90px] bg-background z-10 font-medium">{emp.employeeName}</TableCell>
                <TableCell className="text-xs">{emp.planName || "-"}</TableCell>
                <TableCell className="text-xs">{emp.localCurrency}</TableCell>
                {metrics.map((mc) => {
                  const key = `${mc.componentType}::${mc.metricName}`;
                  return renderSubCells(empPivot.get(key), mc.subCols);
                })}
                <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400 border-l">
                  {formatCurrency(grandIncr)}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(grandBkg)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandColl)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandYe)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}