/**
 * Audit Trail Export Report
 * 
 * Comprehensive audit log viewer with filters and export capability.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Search, FileText, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuditLog, AUDIT_CATEGORIES, AUDIT_ACTIONS, AuditLogEntry } from "@/hooks/useAuditLog";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { exportToXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AuditTrailExport() {
  const { selectedYear } = useFiscalYear();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Date filters
  const startDate = selectedMonth === "all" 
    ? `${selectedYear}-01-01`
    : `${selectedMonth}-01`;
  const endDate = selectedMonth === "all"
    ? `${selectedYear}-12-31`
    : `${selectedMonth}-28`;

  const { data: auditLogs, isLoading } = useAuditLog({
    startDate,
    endDate,
    category: selectedCategory !== "all" ? [selectedCategory] : undefined,
  });

  // Get employee names for display
  const { data: employees } = useQuery({
    queryKey: ["employees_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("employee_id, full_name");
      return new Map(data?.map(e => [e.employee_id, e.full_name]) || []);
    },
  });

  const months = [
    { value: "all", label: "All Months" },
    ...Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const value = `${selectedYear}-${m.toString().padStart(2, '0')}`;
      return { value, label: format(new Date(`${value}-01`), 'MMMM yyyy') };
    }),
  ];

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    
    return auditLogs.filter(log => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      const empName = log.employee_id ? employees?.get(log.employee_id)?.toLowerCase() : '';
      return (
        log.action.toLowerCase().includes(searchLower) ||
        log.entity_type.toLowerCase().includes(searchLower) ||
        empName?.includes(searchLower) ||
        log.reason?.toLowerCase().includes(searchLower)
      );
    });
  }, [auditLogs, searchTerm, employees]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('mismatch')) return 'destructive';
    if (action.includes('approved') || action.includes('finalized')) return 'default';
    if (action.includes('rejected')) return 'secondary';
    if (action.includes('clawback')) return 'destructive';
    return 'outline';
  };

  const formatDetails = (log: AuditLogEntry): string => {
    if (log.amount_usd) {
      return `$${log.amount_usd.toLocaleString()} USD`;
    }
    if (log.compensation_rate && log.market_rate) {
      return `Comp: ${log.compensation_rate} / Market: ${log.market_rate}`;
    }
    if (log.rate_variance_pct) {
      return `${log.rate_variance_pct.toFixed(2)}% variance`;
    }
    if (log.new_values?.run_status) {
      return `Status → ${log.new_values.run_status}`;
    }
    if (log.month_year) {
      return format(new Date(log.month_year), 'MMMM yyyy');
    }
    return '-';
  };

  const handleExport = () => {
    if (!filteredLogs) return;
    
    exportToXLSX(
      filteredLogs.map(log => ({
        timestamp: format(new Date(log.changed_at), 'yyyy-MM-dd HH:mm:ss'),
        event: log.action,
        category: log.audit_category || log.entity_type,
        employee: log.employee_id ? employees?.get(log.employee_id) || log.employee_id : '-',
        amount_usd: log.amount_usd || '',
        amount_local: log.amount_local || '',
        currency: log.local_currency || '',
        comp_rate: log.compensation_rate || '',
        market_rate: log.market_rate || '',
        rate_type: log.rate_type || '',
        variance_pct: log.rate_variance_pct || '',
        is_mismatch: log.is_rate_mismatch ? 'Yes' : '',
        reason: log.reason || '',
        month_year: log.month_year || '',
      })),
      `audit_trail_${selectedYear}${selectedMonth !== 'all' ? `_${selectedMonth}` : ''}`
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Count rate mismatches
  const mismatchCount = auditLogs?.filter(l => l.is_rate_mismatch).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail Export - FY{selectedYear}
          </h2>
          <p className="text-muted-foreground">
            Comprehensive system activity log with rate tracking
          </p>
        </div>
        <Button onClick={handleExport} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
          <Download className="mr-2 h-4 w-4" />
          Export Full Trail
        </Button>
      </div>

      {/* Rate Mismatch Warning */}
      {mismatchCount > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span>
              <strong>{mismatchCount} rate mismatch{mismatchCount !== 1 ? 'es' : ''}</strong> detected 
              (compensation vs market rate variance &gt;10%)
            </span>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by event, employee, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {AUDIT_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            {filteredLogs?.length || 0} entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-[hsl(var(--azentio-navy))]">
                  <TableHead className="text-white">Timestamp</TableHead>
                  <TableHead className="text-white">Event</TableHead>
                  <TableHead className="text-white">Category</TableHead>
                  <TableHead className="text-white">Employee</TableHead>
                  <TableHead className="text-white">Details</TableHead>
                  <TableHead className="text-white">Rate Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.slice(0, 200).map(log => (
                  <TableRow key={log.id} className={log.is_rate_mismatch ? 'bg-warning/10' : ''}>
                    <TableCell className="text-sm">
                      {format(new Date(log.changed_at), 'MMM dd, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.audit_category || log.entity_type}
                    </TableCell>
                    <TableCell>
                      {log.employee_id 
                        ? employees?.get(log.employee_id) || log.employee_id 
                        : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {formatDetails(log)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.compensation_rate || log.market_rate ? (
                        <span>
                          {log.compensation_rate && `C:${log.compensation_rate}`}
                          {log.compensation_rate && log.market_rate && ' / '}
                          {log.market_rate && `M:${log.market_rate}`}
                        </span>
                      ) : log.exchange_rate_used ? (
                        <span>Rate: {log.exchange_rate_used}</span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {filteredLogs && filteredLogs.length > 200 && (
            <p className="text-center text-muted-foreground py-4">
              Showing first 200 of {filteredLogs.length} entries. Export for full data.
            </p>
          )}
          {(!filteredLogs || filteredLogs.length === 0) && (
            <p className="text-center text-muted-foreground py-8">No audit entries found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
