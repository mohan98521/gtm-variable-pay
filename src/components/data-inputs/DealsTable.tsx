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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { DealWithParticipants, PARTICIPANT_ROLES, useDeleteDeal } from "@/hooks/useDeals";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function DealsTable({ deals, onEdit, isLoading }: DealsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDeal = useDeleteDeal();

  // Fetch employees for name lookup
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.employee_id === employeeId);
    return employee?.full_name || employeeId;
  };

  const getEmployeeInitials = (employeeId: string) => {
    const name = getEmployeeName(employeeId);
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (roleValue: string) => {
    const role = PARTICIPANT_ROLES.find((r) => r.value === roleValue);
    return role?.label || roleValue;
  };

  const formatCurrency = (value: number) => {
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
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal ID</TableHead>
              <TableHead>Deal Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => (
              <TableRow key={deal.id} className="data-row">
                <TableCell className="font-mono text-sm">
                  {deal.deal_id}
                </TableCell>
                <TableCell className="font-medium">{deal.deal_name}</TableCell>
                <TableCell>{deal.client_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(deal.month_year), "MMM yyyy")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(deal.deal_value_usd)}
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-2">
                    {deal.deal_participants.slice(0, 4).map((participant, idx) => (
                      <Tooltip key={participant.id}>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getEmployeeInitials(participant.employee_id)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">
                            {getEmployeeName(participant.employee_id)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleLabel(participant.participant_role)} ({participant.split_percent}%)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {deal.deal_participants.length > 4 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                              +{deal.deal_participants.length - 4}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{deal.deal_participants.length - 4} more participants</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {deal.deal_participants.length === 0 && (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
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
