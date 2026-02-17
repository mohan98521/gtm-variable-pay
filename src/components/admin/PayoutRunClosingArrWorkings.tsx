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
import { useClosingArrPayoutDetails, ClosingArrPayoutDetailRow } from "@/hooks/useClosingArrPayoutDetails";

interface PayoutRunClosingArrWorkingsProps {
  payoutRunId: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

export function PayoutRunClosingArrWorkings({ payoutRunId }: PayoutRunClosingArrWorkingsProps) {
  const { data: details, isLoading } = useClosingArrPayoutDetails(payoutRunId);
  const [search, setSearch] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState<"all" | "eligible" | "excluded">("all");
  const [multiYearFilter, setMultiYearFilter] = useState<"all" | "yes" | "no">("all");

  const filtered = useMemo(() => {
    if (!details) return [];
    return details.filter(d => {
      if (search) {
        const q = search.toLowerCase();
        const match = (d.employee_name || '').toLowerCase().includes(q) ||
          (d.employee_code || '').toLowerCase().includes(q) ||
          (d.pid || '').toLowerCase().includes(q) ||
          (d.customer_name || '').toLowerCase().includes(q) ||
          (d.customer_code || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (eligibilityFilter === "eligible" && !d.is_eligible) return false;
      if (eligibilityFilter === "excluded" && d.is_eligible) return false;
      if (multiYearFilter === "yes" && !d.is_multi_year) return false;
      if (multiYearFilter === "no" && d.is_multi_year) return false;
      return true;
    });
  }, [details, search, eligibilityFilter, multiYearFilter]);

  const summary = useMemo(() => {
    if (!details) return { total: 0, eligible: 0, excluded: 0 };
    return {
      total: details.length,
      eligible: details.filter(d => d.is_eligible).length,
      excluded: details.filter(d => !d.is_eligible).length,
    };
  }, [details]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!details || details.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No Closing ARR project-level workings available. Run the calculation to generate details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Total Projects: {summary.total}
        </Badge>
        <Badge variant="default" className="text-xs">
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
            placeholder="Search employee, PID, customer..."
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
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="eligible">Eligible Only</SelectItem>
            <SelectItem value="excluded">Excluded Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={multiYearFilter} onValueChange={(v) => setMultiYearFilter(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Multi-Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Multi-Year Only</SelectItem>
            <SelectItem value="no">Single Year Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>PID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>BU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-center">Multi-Year?</TableHead>
              <TableHead className="text-right">Renewal Yrs</TableHead>
              <TableHead className="text-right">Closing ARR</TableHead>
              <TableHead className="text-right">Multiplier</TableHead>
              <TableHead className="text-right">Adjusted ARR</TableHead>
              <TableHead className="text-center">Eligible?</TableHead>
              <TableHead>Exclusion Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className={!d.is_eligible ? 'text-muted-foreground bg-muted/30' : ''}>
                <TableCell className="font-medium whitespace-nowrap">
                  {d.employee_name}
                  <span className="text-xs text-muted-foreground ml-1">({d.employee_code})</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{d.pid}</TableCell>
                <TableCell>{d.customer_name || '-'}</TableCell>
                <TableCell>{d.bu || '-'}</TableCell>
                <TableCell>{d.product || '-'}</TableCell>
                <TableCell>
                  {d.order_category_2 ? (
                    <Badge variant="outline" className="text-xs capitalize">{d.order_category_2}</Badge>
                  ) : '-'}
                </TableCell>
                <TableCell>{formatDate(d.end_date)}</TableCell>
                <TableCell className="text-center">
                  {d.is_multi_year ? (
                    <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{d.renewal_years}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.closing_arr_usd)}</TableCell>
                <TableCell className="text-right">{d.multiplier.toFixed(2)}x</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(d.adjusted_arr_usd)}</TableCell>
                <TableCell className="text-center">
                  {d.is_eligible ? (
                    <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                  {d.exclusion_reason || '-'}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                  No projects match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
