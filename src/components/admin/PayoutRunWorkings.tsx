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
import { usePayoutMetricDetails, EmployeeWorkings } from "@/hooks/usePayoutMetricDetails";

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
  return `${value.toFixed(1)}%`;
};

const formatMultiplier = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return '-';
  return `${value.toFixed(2)}x`;
};

function EmployeeWorkingsCard({ emp }: { emp: EmployeeWorkings }) {
  const vpTotal = emp.vpDetails.reduce((s, d) => s + d.this_month_usd, 0);
  const commTotal = emp.commissionDetails.reduce((s, d) => s + d.this_month_usd, 0);
  const otherTotal = emp.otherDetails.reduce((s, d) => s + d.this_month_usd, 0);
  const grandTotal = vpTotal + commTotal + otherTotal;
  
  return (
    <div className="space-y-4">
      {/* Section 1: VP Metric-Level Workings */}
      {emp.vpDetails.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Variable Pay — Metric-Level Workings</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">YTD Actuals</TableHead>
                  <TableHead className="text-right">Ach %</TableHead>
                  <TableHead className="text-right">Allocated OTE</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                  <TableHead className="text-right">YTD Eligible</TableHead>
                  <TableHead className="text-right">Prior Paid</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emp.vpDetails.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.metric_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.target_usd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.actual_usd)}</TableCell>
                    <TableCell className="text-right">{formatPct(d.achievement_pct)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.allocated_ote_usd)}</TableCell>
                    <TableCell className="text-right">{formatMultiplier(d.multiplier)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.ytd_eligible_usd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.prior_paid_usd)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>
                  </TableRow>
                ))}
                {emp.vpDetails.length > 1 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>VP Total</TableCell>
                    <TableCell colSpan={3} />
                    <TableCell className="text-right">
                      {formatCurrency(emp.vpDetails.reduce((s, d) => s + d.allocated_ote_usd, 0))}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      {formatCurrency(emp.vpDetails.reduce((s, d) => s + d.ytd_eligible_usd, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(emp.vpDetails.reduce((s, d) => s + d.prior_paid_usd, 0))}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(vpTotal)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Section 2: Three-Way Split */}
      {emp.allDetails.filter(d => !['collection_release', 'year_end_release', 'clawback'].includes(d.component_type)).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Three-Way Split</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Eligible (USD)</TableHead>
                  <TableHead className="text-right">Upon Booking</TableHead>
                  <TableHead className="text-right">Upon Collection</TableHead>
                  <TableHead className="text-right">At Year End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* VP aggregate row */}
                {vpTotal > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">Variable Pay</TableCell>
                    <TableCell className="text-right">{formatCurrency(vpTotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(emp.vpDetails.reduce((s, d) => s + d.booking_usd, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(emp.vpDetails.reduce((s, d) => s + d.collection_usd, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(emp.vpDetails.reduce((s, d) => s + d.year_end_usd, 0))}</TableCell>
                  </TableRow>
                )}
                {/* Commission rows */}
                {emp.commissionDetails.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">Commission: {d.metric_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.this_month_usd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
                  </TableRow>
                ))}
                {/* NRR, SPIFF, Deal Team SPIFF */}
                {emp.otherDetails
                  .filter(d => ['nrr', 'spiff', 'deal_team_spiff'].includes(d.component_type))
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.metric_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.this_month_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Section 3: Payable This Month */}
      <div>
        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Payable This Month</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line Item</TableHead>
                <TableHead className="text-right">Amount (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Booking totals */}
              {(vpTotal + commTotal) > 0 && (
                <TableRow>
                  <TableCell>Upon Booking</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      emp.allDetails
                        .filter(d => !['collection_release', 'year_end_release', 'clawback'].includes(d.component_type))
                        .reduce((s, d) => s + d.booking_usd, 0)
                    )}
                  </TableCell>
                </TableRow>
              )}
              {/* Collection Releases */}
              {emp.otherDetails.filter(d => d.component_type === 'collection_release').map(d => (
                <TableRow key={d.id}>
                  <TableCell>Collection Releases</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.this_month_usd)}</TableCell>
                </TableRow>
              ))}
              {/* Year-End Releases */}
              {emp.otherDetails.filter(d => d.component_type === 'year_end_release').map(d => (
                <TableRow key={d.id}>
                  <TableCell>Year-End Releases</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.this_month_usd)}</TableCell>
                </TableRow>
              ))}
              {/* Clawback Recovery */}
              {emp.otherDetails.filter(d => d.component_type === 'clawback').map(d => (
                <TableRow key={d.id} className="text-destructive">
                  <TableCell className="font-medium">Clawback Recovery</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(d.this_month_usd)}</TableCell>
                </TableRow>
              ))}
              {/* Grand Total */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Payable This Month</TableCell>
                <TableCell className="text-right text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(grandTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
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
