import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle, Download } from "lucide-react";
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
    const label = category === "software" ? "Software" : "Managed Service";
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
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>
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
            {records.map((record) => {
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
