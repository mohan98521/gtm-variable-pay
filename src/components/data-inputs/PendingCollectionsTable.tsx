import { useState, useMemo } from "react";
import { format, parseISO, differenceInMonths, isAfter } from "date-fns";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Check,
  Clock,
  Edit,
  Download,
  Upload,
  ChevronDown,
  Lock,
} from "lucide-react";
import { DealCollection, useUpdateCollectionStatus } from "@/hooks/useCollections";
import { useMonthLockStatuses } from "@/hooks/useMonthLockStatus";
import { CollectionFormDialog } from "./CollectionFormDialog";
import { CollectionsBulkUpload } from "./CollectionsBulkUpload";
import { generateXLSX, downloadXLSX } from "@/lib/xlsxExport";
import { generateCSV, downloadCSV } from "@/lib/csvExport";

interface PendingCollectionsTableProps {
  collections: DealCollection[];
  isLoading?: boolean;
}

export function PendingCollectionsTable({ collections, isLoading }: PendingCollectionsTableProps) {
  const [editingCollection, setEditingCollection] = useState<DealCollection | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const updateMutation = useUpdateCollectionStatus();

  // Get all unique booking months and check their lock status
  const bookingMonths = useMemo(
    () => collections.map((c) => c.booking_month),
    [collections]
  );
  const { lockStatusMap } = useMonthLockStatuses(bookingMonths);

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

  const getMonthsPending = (bookingMonth: string) => {
    try {
      const booking = parseISO(bookingMonth);
      const now = new Date();
      return Math.max(0, differenceInMonths(now, booking));
    } catch {
      return 0;
    }
  };

  const getCollectionStatus = (collection: DealCollection) => {
    // Check if past due date
    if (collection.first_milestone_due_date) {
      const dueDate = parseISO(collection.first_milestone_due_date);
      if (isAfter(new Date(), dueDate)) {
        return { status: "overdue", label: "Overdue", variant: "destructive" as const };
      }
    }
    return { status: "pending", label: "Pending", variant: "secondary" as const };
  };

  const handleQuickUpdate = async (id: string, isCollected: boolean) => {
    updateMutation.mutate({
      id,
      is_collected: isCollected,
      collection_date: isCollected ? format(new Date(), "yyyy-MM-dd") : null,
    });
  };

  const getExportData = () => {
    return collections.map((row) => ({
      project_id: row.project_id,
      customer_name: row.customer_name || "",
      deal_value_usd: row.deal_value_usd || 0,
      booking_month: formatMonth(row.booking_month),
      type_of_proposal: row.deal?.type_of_proposal || "",
      sales_rep_name: row.deal?.sales_rep_name || "",
      is_collected: "No",
      collection_date: "",
      notes: row.notes || "",
    }));
  };

  const exportColumns = [
    { key: "project_id", header: "project_id" },
    { key: "customer_name", header: "customer_name" },
    { key: "deal_value_usd", header: "deal_value_usd" },
    { key: "booking_month", header: "booking_month" },
    { key: "type_of_proposal", header: "type_of_proposal" },
    { key: "sales_rep_name", header: "sales_rep_name" },
    { key: "is_collected", header: "is_collected" },
    { key: "collection_date", header: "collection_date" },
    { key: "notes", header: "notes" },
  ];

  const handleExportExcel = () => {
    const blob = generateXLSX(getExportData(), exportColumns as any, "Pending Collections");
    downloadXLSX(blob, `pending-collections-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const handleExportCSV = () => {
    const csv = generateCSV(getExportData(), exportColumns as any);
    downloadCSV(csv, `pending-collections-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  // Sort by booking month (oldest first) - already done by query, but ensure consistency
  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => 
      new Date(a.booking_month).getTime() - new Date(b.booking_month).getTime()
    );
  }, [collections]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const overdue = collections.filter(c => {
      if (!c.first_milestone_due_date) return false;
      return isAfter(now, parseISO(c.first_milestone_due_date));
    }).length;
    
    const thisMonth = format(now, "yyyy-MM");
    const dueThisMonth = collections.filter(c => {
      if (!c.first_milestone_due_date) return false;
      return c.first_milestone_due_date.startsWith(thisMonth);
    }).length;

    const totalValue = collections.reduce((sum, c) => sum + (c.deal_value_usd || 0), 0);

    return { overdue, dueThisMonth, totalValue };
  }, [collections]);

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
        <Check className="h-12 w-12 text-success mb-4" />
        <h3 className="text-lg font-medium text-foreground">No Pending Collections</h3>
        <p className="text-muted-foreground max-w-md">
          All deal collections have been processed. New collections will appear here when deals are added.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Clock className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Total Pending</p>
            <p className="text-xl font-semibold">{collections.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-xl font-semibold">{stats.overdue}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Clock className="h-8 w-8 text-warning" />
          <div>
            <p className="text-sm text-muted-foreground">Due This Month</p>
            <p className="text-xl font-semibold">{stats.dueThisMonth}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary text-lg font-semibold">$</div>
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-xl font-semibold">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => setBulkUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Import Status
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1.5" />
              Export
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              Export to CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              Export to Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking Month</TableHead>
              <TableHead className="text-center">Months Pending</TableHead>
              <TableHead>Project ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead className="text-right">Deal Value</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Collected?</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCollections.map((collection) => {
              const status = getCollectionStatus(collection);
              const monthsPending = getMonthsPending(collection.booking_month);
              const isLinkedToImpl = collection.deal?.linked_to_impl;
              const isMonthLocked = lockStatusMap.get(collection.booking_month) ?? false;
              
              return (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {formatMonth(collection.booking_month)}
                      {isMonthLocked && (
                        <Lock className="h-3 w-3 text-warning" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={monthsPending > 2 ? "destructive" : monthsPending > 0 ? "secondary" : "outline"}>
                      {monthsPending}
                    </Badge>
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
                  <TableCell className="text-right font-medium">
                    {formatCurrency(collection.deal_value_usd)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {formatDate(collection.first_milestone_due_date)}
                      {status.status === "overdue" && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>
                      {status.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {status.status === "overdue" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Select
                              value="no"
                              onValueChange={(value) => handleQuickUpdate(collection.id, value === "yes")}
                              disabled={updateMutation.isPending || isMonthLocked}
                            >
                              <SelectTrigger className={`w-24 h-8 ${isMonthLocked ? 'opacity-50' : ''}`}>
                                {isMonthLocked && <Lock className="h-3 w-3 mr-1" />}
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">
                                  <span className="flex items-center gap-1">
                                    <Check className="h-3 w-3 text-success" />
                                    Yes
                                  </span>
                                </SelectItem>
                                <SelectItem value="no">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    No
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </span>
                        </TooltipTrigger>
                        {isMonthLocked && (
                          <TooltipContent>
                            Booking month is locked for payouts
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingCollection(collection)}
                              disabled={isMonthLocked}
                            >
                              {isMonthLocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Edit className="h-4 w-4" />}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {isMonthLocked && (
                          <TooltipContent>
                            Booking month is locked for payouts
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CollectionFormDialog
        open={!!editingCollection}
        onOpenChange={(open) => !open && setEditingCollection(null)}
        collection={editingCollection}
      />

      <CollectionsBulkUpload
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />
    </>
  );
}
