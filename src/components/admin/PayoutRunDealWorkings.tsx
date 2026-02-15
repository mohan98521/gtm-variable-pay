import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { usePayoutDealDetails, PayoutDealDetailRow } from "@/hooks/usePayoutDealDetails";

interface PayoutRunDealWorkingsProps {
  payoutRunId: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

export function PayoutRunDealWorkings({ payoutRunId }: PayoutRunDealWorkingsProps) {
  const { data: deals, isLoading } = usePayoutDealDetails(payoutRunId);
  const [search, setSearch] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState<"all" | "eligible" | "excluded">("all");
  const [commTypeFilter, setCommTypeFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");

  const commissionTypes = useMemo(() => {
    if (!deals) return [];
    return [...new Set(deals.map(d => d.commission_type))].sort();
  }, [deals]);

  const filtered = useMemo(() => {
    if (!deals) return [];
    return deals.filter(d => {
      if (search) {
        const q = search.toLowerCase();
        const match = (d.employee_name || '').toLowerCase().includes(q) ||
          (d.employee_code || '').toLowerCase().includes(q) ||
          (d.project_id || '').toLowerCase().includes(q) ||
          (d.customer_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (eligibilityFilter === "eligible" && !d.is_eligible) return false;
      if (eligibilityFilter === "excluded" && d.is_eligible) return false;
      if (commTypeFilter !== "all" && d.commission_type !== commTypeFilter) return false;
      if (componentFilter !== "all" && d.component_type !== componentFilter) return false;
      return true;
    });
  }, [deals, search, eligibilityFilter, commTypeFilter, componentFilter]);

  const summary = useMemo(() => {
    if (!deals) return { total: 0, eligible: 0, excluded: 0 };
    return {
      total: deals.length,
      eligible: deals.filter(d => d.is_eligible).length,
      excluded: deals.filter(d => !d.is_eligible).length,
    };
  }, [deals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deals || deals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No deal-level workings available. Run the calculation to generate deal details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Total: {summary.total}
        </Badge>
        <Badge variant="default" className="text-xs bg-emerald-600">
          Eligible: {summary.eligible}
        </Badge>
        {summary.excluded > 0 && (
          <Badge variant="destructive" className="text-xs">
            Excluded: {summary.excluded}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee, project, customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={eligibilityFilter} onValueChange={(v) => setEligibilityFilter(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Eligibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            <SelectItem value="eligible">Eligible Only</SelectItem>
            <SelectItem value="excluded">Excluded Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={commTypeFilter} onValueChange={setCommTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Commission Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {commissionTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={componentFilter} onValueChange={setComponentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Component" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Components</SelectItem>
            <SelectItem value="commission">Commission</SelectItem>
            <SelectItem value="variable_pay">Variable Pay</SelectItem>
            <SelectItem value="nrr">NRR</SelectItem>
            <SelectItem value="spiff">SPIFF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Project ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Commission Type</TableHead>
              <TableHead className="text-right">Deal Value</TableHead>
              <TableHead className="text-right">GP Margin</TableHead>
              <TableHead className="text-right">Min GP</TableHead>
              <TableHead className="text-center">Eligible?</TableHead>
              <TableHead>Exclusion Reason</TableHead>
              <TableHead className="text-right">Rate / Mix %</TableHead>
              <TableHead className="text-right">Gross Commission</TableHead>
              <TableHead className="text-right">Upon Booking</TableHead>
              <TableHead className="text-right">Upon Collection</TableHead>
              <TableHead className="text-right">At Year End</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className={!d.is_eligible ? 'text-muted-foreground bg-muted/30' : ''}>
                <TableCell className="font-medium whitespace-nowrap">
                  {d.employee_name}
                  <span className="text-xs text-muted-foreground ml-1">({d.employee_code})</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {(d.component_type || 'commission').replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{d.project_id || '-'}</TableCell>
                <TableCell>{d.customer_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{d.commission_type}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(d.deal_value_usd)}</TableCell>
                <TableCell className="text-right">
                  {d.gp_margin_pct != null ? `${d.gp_margin_pct}%` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {d.min_gp_margin_pct != null ? `${d.min_gp_margin_pct}%` : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {d.is_eligible ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                  {d.exclusion_reason || '-'}
                </TableCell>
                <TableCell className="text-right">{d.commission_rate_pct.toFixed(2)}%</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(d.gross_commission_usd)}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.booking_usd)}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.collection_usd)}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.year_end_usd)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                  No deals match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
