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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Pencil, Trash2, Users, Download } from "lucide-react";
import { DealWithParticipants, PROPOSAL_TYPES, useDeleteDeal } from "@/hooks/useDeals";
import { format } from "date-fns";
import { generateCSV, downloadCSV } from "@/lib/csvExport";

interface DealsTableProps {
  deals: DealWithParticipants[];
  onEdit: (deal: DealWithParticipants) => void;
  isLoading?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const proposalTypeColors: Record<string, string> = {
  amc: "bg-blue-500/10 text-blue-700",
  subscription: "bg-purple-500/10 text-purple-700",
  managed_services: "bg-teal-500/10 text-teal-700",
  perpetual_licence: "bg-amber-500/10 text-amber-700",
  cr: "bg-orange-500/10 text-orange-700",
  er: "bg-pink-500/10 text-pink-700",
  implementation: "bg-green-500/10 text-green-700",
};

export function DealsTable({ deals, onEdit, isLoading }: DealsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDeal = useDeleteDeal();

  const getProposalTypeLabel = (value: string) => {
    const type = PROPOSAL_TYPES.find((t) => t.value === value);
    return type?.label || value;
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

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDeal.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleExportCSV = () => {
    const csvColumns = [
      { key: "project_id", header: "Project ID" },
      { key: "customer_code", header: "Customer Code" },
      { key: "bu", header: "BU" },
      { key: "product", header: "Product" },
      { key: "region", header: "Region" },
      { key: "country", header: "Country" },
      { key: "type_of_proposal", header: "Type of Proposal", getValue: (row: DealWithParticipants) => getProposalTypeLabel(row.type_of_proposal) },
      { key: "month_year", header: "Month" },
      { key: "new_software_booking_arr_usd", header: "New Software Booking ARR (USD)" },
      { key: "tcv_usd", header: "TCV (USD)" },
      { key: "first_year_amc_usd", header: "First Year AMC (USD)" },
      { key: "first_year_subscription_usd", header: "First Year Subscription (USD)" },
      { key: "managed_services_usd", header: "Managed Services (USD)" },
      { key: "cr_usd", header: "CR (USD)" },
      { key: "er_usd", header: "ER (USD)" },
      { key: "implementation_usd", header: "Implementation (USD)" },
      { key: "gp_margin_percent", header: "GP Margin %" },
      { key: "status", header: "Status" },
      { key: "sales_rep_name", header: "Sales Rep Name" },
      { key: "sales_rep_employee_id", header: "Sales Rep Employee ID" },
      { key: "sales_head_name", header: "Sales Head Name" },
      { key: "sales_head_employee_id", header: "Sales Head Employee ID" },
      { key: "notes", header: "Notes" },
    ];

    const csv = generateCSV(deals, csvColumns);
    const monthLabel = deals.length > 0 
      ? format(new Date(deals[0].month_year), "yyyy-MM") 
      : "export";
    downloadCSV(csv, `deals-${monthLabel}.csv`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading deals...
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No deals found</p>
        <p className="text-sm">Add your first deal to get started.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>BU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">ARR USD</TableHead>
              <TableHead className="text-right">TCV USD</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => (
              <TableRow key={deal.id} className="data-row">
                <TableCell className="font-mono text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">{deal.project_id}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p><strong>Product:</strong> {deal.product}</p>
                      <p><strong>Region:</strong> {deal.region}</p>
                      <p><strong>Country:</strong> {deal.country}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="font-medium">{deal.customer_code}</TableCell>
                <TableCell className="text-muted-foreground">{deal.bu}</TableCell>
                <TableCell>
                  <Badge className={proposalTypeColors[deal.type_of_proposal] || "bg-muted"}>
                    {getProposalTypeLabel(deal.type_of_proposal)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(deal.month_year), "MMM yyyy")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(deal.new_software_booking_arr_usd)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(deal.tcv_usd)}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[deal.status] || statusColors.draft}>
                    {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(deal)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(deal.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deal? This action cannot be undone
              and will also remove all participant assignments.
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
    </TooltipProvider>
  );
}
