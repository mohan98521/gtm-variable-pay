import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  Download,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { DealCollection } from "@/hooks/useCollections";
import { generateXLSX, downloadXLSX } from "@/lib/xlsxExport";

interface CollectedDealsTableProps {
  collections: DealCollection[];
  isLoading?: boolean;
}

export function CollectedDealsTable({ collections, isLoading }: CollectedDealsTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(parseISO(date), "MMM dd, yyyy");
    } catch {
      return date;
    }
  };

  const formatMonth = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(parseISO(date), "MMM yyyy");
    } catch {
      return date;
    }
  };

  // Get unique collection months for filter
  const collectionMonths = useMemo(() => {
    const months = new Set<string>();
    collections.forEach(c => {
      if (c.collection_month) {
        months.add(c.collection_month);
      } else if (c.collection_date) {
        // Fallback to collection_date if collection_month not set
        const month = c.collection_date.substring(0, 7) + "-01";
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [collections]);

  // Filter collections by selected month
  const filteredCollections = useMemo(() => {
    if (selectedMonth === "all") return collections;
    return collections.filter(c => {
      const collMonth = c.collection_month || (c.collection_date ? c.collection_date.substring(0, 7) + "-01" : null);
      return collMonth === selectedMonth;
    });
  }, [collections, selectedMonth]);

  // Sort by collection date (most recent first)
  const sortedCollections = useMemo(() => {
    return [...filteredCollections].sort((a, b) => {
      const dateA = a.collection_date ? new Date(a.collection_date).getTime() : 0;
      const dateB = b.collection_date ? new Date(b.collection_date).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredCollections]);

  // Calculate stats for selected month
  const stats = useMemo(() => {
    const totalValue = filteredCollections.reduce((sum, c) => sum + (c.collection_amount_usd || c.deal_value_usd || 0), 0);
    const count = filteredCollections.length;
    return { totalValue, count };
  }, [filteredCollections]);

  const handleExport = () => {
    const columns = [
      { key: "collection_date", header: "Collection Date", getValue: (row: DealCollection) => formatDate(row.collection_date) },
      { key: "booking_month", header: "Booking Month", getValue: (row: DealCollection) => formatMonth(row.booking_month) },
      { key: "project_id", header: "Project ID" },
      { key: "customer_name", header: "Customer", getValue: (row: DealCollection) => row.customer_name || "-" },
      { key: "type_of_proposal", header: "Type", getValue: (row: DealCollection) => row.deal?.type_of_proposal || "-" },
      { key: "sales_rep_name", header: "Sales Rep", getValue: (row: DealCollection) => row.deal?.sales_rep_name || "-" },
      { key: "collection_amount_usd", header: "Amount Collected (USD)", getValue: (row: DealCollection) => row.collection_amount_usd || row.deal_value_usd || 0 },
    ];

    const monthLabel = selectedMonth === "all" ? "all" : format(parseISO(selectedMonth), "yyyy-MM");
    const blob = generateXLSX(filteredCollections, columns, "Collected Deals");
    downloadXLSX(blob, `collected-deals-${monthLabel}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No Collected Deals</h3>
        <p className="text-muted-foreground max-w-md">
          Deals will appear here once they are marked as collected from the Pending Collections tab.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Month Filter and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {collectionMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Check className="h-8 w-8 text-success" />
          <div>
            <p className="text-sm text-muted-foreground">
              {selectedMonth === "all" ? "Total Collected" : `Collected in ${formatMonth(selectedMonth)}`}
            </p>
            <p className="text-xl font-semibold">{stats.count} deals</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/10 text-success text-lg font-semibold">$</div>
          <div>
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-xl font-semibold">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Collection Date</TableHead>
              <TableHead>Booking Month</TableHead>
              <TableHead>Project ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead className="text-right">Amount Collected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCollections.map((collection) => {
              const isLinkedToImpl = collection.deal?.linked_to_impl;
              
              return (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">
                    {formatDate(collection.collection_date)}
                  </TableCell>
                  <TableCell>
                    {formatMonth(collection.booking_month)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{collection.project_id}</span>
                      {isLinkedToImpl && (
                        <Badge variant="outline" className="text-xs">
                          Impl
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{collection.customer_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {collection.deal?.type_of_proposal || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {collection.deal?.sales_rep_name || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-success">
                    {formatCurrency(collection.collection_amount_usd || collection.deal_value_usd)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Total Footer */}
      <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Total for {selectedMonth === "all" ? "all periods" : formatMonth(selectedMonth)}:
        </span>
        <span className="text-lg font-semibold text-success">
          {formatCurrency(stats.totalValue)}
        </span>
      </div>
    </>
  );
}
