import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle, Download, X } from "lucide-react";
import { ClosingARRActual, useDeleteClosingARR } from "@/hooks/useClosingARR";
import { format } from "date-fns";
import { generateCSV, downloadCSV } from "@/lib/csvExport";

interface ClosingARRTableProps {
  records: ClosingARRActual[];
  onEdit: (record: ClosingARRActual) => void;
  isLoading?: boolean;
  fiscalYear: number;
}

export function ClosingARRTable({
  records,
  onEdit,
  isLoading,
  fiscalYear,
}: ClosingARRTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ClosingARRActual | null>(null);
  const deleteMutation = useDeleteClosingARR();

  // Filter state
  const [filterPID, setFilterPID] = useState<string>("_all");
  const [filterBU, setFilterBU] = useState<string>("_all");
  const [filterProduct, setFilterProduct] = useState<string>("_all");
  const [filterSalesRep, setFilterSalesRep] = useState<string>("_all");
  const [filterSalesHead, setFilterSalesHead] = useState<string>("_all");
  const [filterCustomer, setFilterCustomer] = useState<string>("_all");

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const pids = [...new Set(records.map((r) => r.pid))].sort();
    const bus = [...new Set(records.map((r) => r.bu))].sort();
    const products = [...new Set(records.map((r) => r.product))].sort();
    const salesReps = [...new Set(records.map((r) => r.sales_rep_name).filter(Boolean))].sort() as string[];
    const salesHeads = [...new Set(records.map((r) => r.sales_head_name).filter(Boolean))].sort() as string[];
    const customers = [...new Set(records.map((r) => r.customer_name))].sort();
    return { pids, bus, products, salesReps, salesHeads, customers };
  }, [records]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (filterPID !== "_all" && record.pid !== filterPID) return false;
      if (filterBU !== "_all" && record.bu !== filterBU) return false;
      if (filterProduct !== "_all" && record.product !== filterProduct) return false;
      if (filterSalesRep !== "_all" && record.sales_rep_name !== filterSalesRep) return false;
      if (filterSalesHead !== "_all" && record.sales_head_name !== filterSalesHead) return false;
      if (filterCustomer !== "_all" && record.customer_name !== filterCustomer) return false;
      return true;
    });
  }, [records, filterPID, filterBU, filterProduct, filterSalesRep, filterSalesHead, filterCustomer]);

  const hasActiveFilters = filterPID !== "_all" || filterBU !== "_all" || filterProduct !== "_all" || 
    filterSalesRep !== "_all" || filterSalesHead !== "_all" || filterCustomer !== "_all";

  const clearAllFilters = () => {
    setFilterPID("_all");
    setFilterBU("_all");
    setFilterProduct("_all");
    setFilterSalesRep("_all");
    setFilterSalesHead("_all");
    setFilterCustomer("_all");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const isEligible = (record: ClosingARRActual) => {
    if (!record.end_date) return false;
    const fiscalYearEnd = new Date(fiscalYear, 11, 31);
    return new Date(record.end_date) > fiscalYearEnd;
  };

  const calculateChanges = (record: ClosingARRActual) => {
    return (
      (record.cr || 0) +
      (record.als_others || 0) +
      (record.new || 0) +
      (record.inflation || 0) -
      (record.discount_decrement || 0) -
      (record.churn || 0) +
      (record.adjustment || 0)
    );
  };

  const handleDelete = async () => {
    if (recordToDelete) {
      await deleteMutation.mutateAsync(recordToDelete.id);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;
    const variant = category === "software" ? "default" : "secondary";
    const label = category === "software" ? "Software" : "Managed Services";
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleExportCSV = () => {
    const csvColumns = [
      { key: "month_year", header: "Month" },
      { key: "bu", header: "BU" },
      { key: "product", header: "Product" },
      { key: "pid", header: "PID" },
      { key: "customer_code", header: "Customer Code" },
      { key: "customer_name", header: "Customer Name" },
      { key: "order_category", header: "Order Category" },
      { key: "status", header: "Status" },
      { key: "order_category_2", header: "Order Category 2" },
      { key: "opening_arr", header: "Opening ARR" },
      { key: "cr", header: "CR" },
      { key: "als_others", header: "ALS + Others" },
      { key: "new", header: "New" },
      { key: "inflation", header: "Inflation" },
      { key: "discount_decrement", header: "Discount/Decrement" },
      { key: "churn", header: "Churn" },
      { key: "adjustment", header: "Adjustment" },
      { key: "closing_arr", header: "Closing ARR" },
      { key: "country", header: "Country" },
      { key: "revised_region", header: "Revised Region" },
      { key: "start_date", header: "Start Date" },
      { key: "end_date", header: "End Date" },
      { key: "renewal_status", header: "Renewal Status" },
      { key: "sales_rep_employee_id", header: "Sales Rep Employee ID" },
      { key: "sales_rep_name", header: "Sales Rep Name" },
      { key: "sales_head_employee_id", header: "Sales Head Employee ID" },
      { key: "sales_head_name", header: "Sales Head Name" },
      { 
        key: "eligible", 
        header: "Eligible", 
        getValue: (row: ClosingARRActual) => isEligible(row) ? "Yes" : "No" 
      },
    ];

    const csv = generateCSV(records, csvColumns);
    const monthLabel = records.length > 0 
      ? format(new Date(records[0].month_year), "yyyy-MM") 
      : "export";
    downloadCSV(csv, `closing-arr-${monthLabel}.csv`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No Closing ARR records for this month.</p>
        <p className="text-sm mt-1">Add a record manually or use bulk upload.</p>
      </div>
    );
  }

  return (
    <>
      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={filterPID} onValueChange={setFilterPID}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter PID" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All PIDs</SelectItem>
            {filterOptions.pids.map((pid) => (
              <SelectItem key={pid} value={pid}>{pid}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterBU} onValueChange={setFilterBU}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter BU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All BUs</SelectItem>
            {filterOptions.bus.map((bu) => (
              <SelectItem key={bu} value={bu}>{bu}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Products</SelectItem>
            {filterOptions.products.map((product) => (
              <SelectItem key={product} value={product}>{product}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Customers</SelectItem>
            {filterOptions.customers.map((customer) => (
              <SelectItem key={customer} value={customer}>{customer}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSalesRep} onValueChange={setFilterSalesRep}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter Sales Rep" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Sales Reps</SelectItem>
            {filterOptions.salesReps.map((rep) => (
              <SelectItem key={rep} value={rep}>{rep}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSalesHead} onValueChange={setFilterSalesHead}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter Sales Head" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Sales Heads</SelectItem>
            {filterOptions.salesHeads.map((head) => (
              <SelectItem key={head} value={head}>{head}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-10">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-10">
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground mb-2">
          Showing {filteredRecords.length} of {records.length} records
        </p>
      )}
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">PID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>BU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Opening ARR</TableHead>
              <TableHead className="text-right">Changes (+/−)</TableHead>
              <TableHead className="text-right">Closing ARR</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-center">Eligible</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead className="sticky right-0 bg-background z-10">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((record) => {
              const changes = calculateChanges(record);
              const eligible = isEligible(record);

              return (
                <TableRow key={record.id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {record.pid}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={record.customer_name}>
                    {record.customer_name}
                  </TableCell>
                  <TableCell>{record.bu}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={record.product}>
                    {record.product}
                  </TableCell>
                  <TableCell>{getCategoryBadge(record.order_category_2)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(record.opening_arr)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${changes >= 0 ? "text-success" : "text-destructive"}`}>
                    {changes >= 0 ? "+" : ""}
                    {formatCurrency(changes)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(record.closing_arr)}
                  </TableCell>
                  <TableCell>{formatDate(record.end_date)}</TableCell>
                  <TableCell className="text-center">
                    {eligible ? (
                      <CheckCircle className="h-4 w-4 text-success mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate" title={record.sales_rep_name || "-"}>
                    {record.sales_rep_name || "-"}
                  </TableCell>
                  <TableCell className="sticky right-0 bg-background z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setRecordToDelete(record);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the Closing ARR record for project{" "}
              <span className="font-semibold">{recordToDelete?.pid}</span>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
