import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import type { UnifiedAuditEntry } from "@/hooks/useUnifiedAuditLog";
import { getTableLabel, getDomainColor } from "@/hooks/useUnifiedAuditLog";

interface AuditDetailPanelProps {
  entry: UnifiedAuditEntry;
  employeeName?: string;
  changedByName?: string;
}

// Human-readable field labels
const FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name",
  email: "Email",
  employee_id: "Employee ID",
  is_active: "Active Status",
  sales_function: "Sales Function",
  business_unit: "Business Unit",
  ote_usd: "OTE (USD)",
  ote_local_currency: "OTE (Local)",
  tfp_usd: "TFP (USD)",
  tvp_usd: "TVP (USD)",
  compensation_exchange_rate: "Comp Exchange Rate",
  target_bonus_percent: "Target Bonus %",
  departure_date: "Departure Date",
  name: "Plan Name",
  effective_year: "Effective Year",
  is_clawback_exempt: "Clawback Exempt",
  payout_frequency: "Payout Frequency",
  metric_name: "Metric Name",
  weightage_percent: "Weight %",
  logic_type: "Logic Type",
  gate_threshold_percent: "Gate Threshold %",
  min_pct: "Min %",
  max_pct: "Max %",
  multiplier_value: "Multiplier",
  target_value_usd: "Target Value (USD)",
  metric_type: "Metric Type",
  rate_to_usd: "Rate to USD",
  currency_code: "Currency Code",
  month_year: "Month/Year",
  role: "Role",
  run_status: "Run Status",
  calculated_amount_usd: "Calculated Amount (USD)",
  booking_amount_usd: "Booking Amount (USD)",
  collection_amount_usd: "Collection Amount (USD)",
  year_end_amount_usd: "Year-End Amount (USD)",
  customer_name: "Customer Name",
  customer_code: "Customer Code",
  tcv_usd: "TCV (USD)",
  status: "Status",
  product: "Product",
  region: "Region",
  country: "Country",
  updated_at: "Updated At",
  created_at: "Created At",
};

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDiff(
  oldVals: Record<string, unknown> | null,
  newVals: Record<string, unknown> | null
): { key: string; oldVal: unknown; newVal: unknown; changed: boolean }[] {
  const allKeys = new Set<string>();
  if (oldVals) Object.keys(oldVals).forEach((k) => allKeys.add(k));
  if (newVals) Object.keys(newVals).forEach((k) => allKeys.add(k));

  // Skip internal/noise fields
  const skipFields = new Set(["id", "created_at", "updated_at"]);

  return Array.from(allKeys)
    .filter((k) => !skipFields.has(k))
    .map((key) => {
      const oldVal = oldVals?.[key] ?? null;
      const newVal = newVals?.[key] ?? null;
      return {
        key,
        oldVal,
        newVal,
        changed: JSON.stringify(oldVal) !== JSON.stringify(newVal),
      };
    })
    .sort((a, b) => {
      // Show changed fields first
      if (a.changed && !b.changed) return -1;
      if (!a.changed && b.changed) return 1;
      return 0;
    });
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

export function AuditDetailPanel({ entry, employeeName, changedByName }: AuditDetailPanelProps) {
  const diff = getDiff(entry.old_values, entry.new_values);
  const changedFields = diff.filter((d) => d.changed);

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className={getDomainColor(entry.domain)}>{entry.domain}</Badge>
            <span>{getTableLabel(entry.table_name)}</span>
            <Badge variant="outline">{entry.action}</Badge>
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.changed_at), "MMM dd, yyyy HH:mm:ss")}
          </span>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
          <span>Changed by: <strong>{changedByName || entry.changed_by || "System"}</strong></span>
          {employeeName && <span>Employee: <strong>{employeeName}</strong></span>}
          {entry.is_retroactive && <Badge variant="destructive" className="text-xs">Retroactive</Badge>}
          {entry.is_rate_mismatch && <Badge variant="destructive" className="text-xs">Rate Mismatch</Badge>}
        </div>
        {entry.reason && (
          <p className="text-sm mt-1"><strong>Reason:</strong> {entry.reason}</p>
        )}
      </CardHeader>
      <CardContent>
        {/* Rate info for payout entries */}
        {(entry.compensation_rate || entry.market_rate) && (
          <div className="flex gap-6 mb-4 p-3 rounded-md bg-muted/50 text-sm">
            {entry.compensation_rate && <span>Comp Rate: <strong>{entry.compensation_rate}</strong></span>}
            {entry.market_rate && <span>Market Rate: <strong>{entry.market_rate}</strong></span>}
            {entry.rate_variance_pct && (
              <span className={entry.is_rate_mismatch ? "text-destructive font-semibold" : ""}>
                Variance: {entry.rate_variance_pct.toFixed(2)}%
              </span>
            )}
            {entry.amount_usd && <span>Amount: <strong>${entry.amount_usd.toLocaleString()}</strong></span>}
          </div>
        )}

        {/* Diff table */}
        {(entry.old_values || entry.new_values) ? (
          <ScrollArea className="max-h-[400px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground w-1/4">Field</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[37.5%]">Old Value</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[37.5%]">New Value</th>
                </tr>
              </thead>
              <tbody>
                {changedFields.length > 0 ? changedFields.map((d) => (
                  <tr key={d.key} className="border-b bg-yellow-50/50 dark:bg-yellow-900/10">
                    <td className="py-2 px-3 font-medium">{getFieldLabel(d.key)}</td>
                    <td className="py-2 px-3 text-destructive/80 line-through">
                      {formatValue(d.oldVal)}
                    </td>
                    <td className="py-2 px-3 text-green-700 dark:text-green-400 font-medium">
                      {formatValue(d.newVal)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No field changes detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-sm">No detail data available</p>
        )}
      </CardContent>
    </Card>
  );
}
