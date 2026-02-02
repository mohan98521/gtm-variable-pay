import { useState } from "react";
import { format, parseISO, isAfter } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Check,
  Clock,
  Edit,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { DealCollection, useUpdateCollectionStatus } from "@/hooks/useCollections";
import { CollectionFormDialog } from "./CollectionFormDialog";

interface CollectionsTableProps {
  collections: DealCollection[];
  isLoading?: boolean;
}

export function CollectionsTable({ collections, isLoading }: CollectionsTableProps) {
  const [editingCollection, setEditingCollection] = useState<DealCollection | null>(null);
  const updateMutation = useUpdateCollectionStatus();

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

  const getCollectionStatus = (collection: DealCollection) => {
    if (collection.is_clawback_triggered) {
      return { status: "clawback", label: "Clawback", variant: "destructive" as const };
    }
    if (collection.is_collected) {
      return { status: "collected", label: "Collected", variant: "default" as const };
    }
    
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
        <h3 className="text-lg font-medium text-foreground">No Collection Records</h3>
        <p className="text-muted-foreground max-w-md">
          Collection records are automatically created when deals are added.
          Add deals in the Deals tab to see them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking Month</TableHead>
              <TableHead>Project ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Deal Type</TableHead>
              <TableHead className="text-right">Deal Value</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Collection Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((collection) => {
              const status = getCollectionStatus(collection);
              const isLinkedToImpl = collection.deal?.linked_to_impl;
              
              return (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">
                    {formatDate(collection.booking_month)}
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
                      {status.status === "collected" && <Check className="h-3 w-3 mr-1" />}
                      {status.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {status.status === "overdue" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!collection.is_clawback_triggered && (
                      <Select
                        value={collection.is_collected ? "yes" : "no"}
                        onValueChange={(value) => handleQuickUpdate(collection.id, value === "yes")}
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-8">
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
                    )}
                    {collection.is_clawback_triggered && (
                      <Badge variant="destructive">
                        Clawback: {formatCurrency(collection.clawback_amount_usd)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingCollection(collection)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
    </>
  );
}
