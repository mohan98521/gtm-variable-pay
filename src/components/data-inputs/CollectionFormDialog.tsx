import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { DealCollection, useUpdateCollectionStatus, useTriggerClawback } from "@/hooks/useCollections";

const formSchema = z.object({
  is_collected: z.boolean(),
  collection_date: z.string().optional().nullable(),
  collection_amount_usd: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface CollectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: DealCollection | null;
}

export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
}: CollectionFormDialogProps) {
  const updateMutation = useUpdateCollectionStatus();
  const clawbackMutation = useTriggerClawback();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      is_collected: false,
      collection_date: null,
      collection_amount_usd: null,
      notes: null,
    },
  });

  const isCollected = form.watch("is_collected");

  useEffect(() => {
    if (open && collection) {
      form.reset({
        is_collected: collection.is_collected,
        collection_date: collection.collection_date,
        collection_amount_usd: collection.collection_amount_usd,
        notes: collection.notes,
      });
    }
  }, [open, collection, form]);

  const handleSubmit = (values: FormValues) => {
    if (!collection) return;

    updateMutation.mutate(
      {
        id: collection.id,
        is_collected: values.is_collected,
        collection_date: values.is_collected ? values.collection_date : null,
        collection_amount_usd: values.is_collected ? values.collection_amount_usd : null,
        notes: values.notes,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleTriggerClawback = () => {
    if (!collection) return;

    // Calculate clawback amount (the booking portion that was paid)
    // This would typically be deal_value * booking_pct from the plan
    // For now, using deal_value as placeholder
    const clawbackAmount = collection.deal_value_usd * 0.75; // 75% booking default

    clawbackMutation.mutate(
      {
        id: collection.id,
        clawback_amount_usd: clawbackAmount,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

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

  const isOverdue = collection?.first_milestone_due_date && 
    new Date() > parseISO(collection.first_milestone_due_date) && 
    !collection.is_collected;

  const isClawedBack = collection?.is_clawback_triggered;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Collection Status</DialogTitle>
          <DialogDescription>
            Update the collection status for this deal. Mark as collected when payment is received.
          </DialogDescription>
        </DialogHeader>

        {collection && (
          <div className="space-y-4">
            {/* Deal Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Project ID</span>
                <span className="font-mono font-medium">{collection.project_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Customer</span>
                <span className="font-medium">{collection.customer_name || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Deal Value</span>
                <span className="font-medium">{formatCurrency(collection.deal_value_usd)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Booking Month</span>
                <span className="font-medium">{formatDate(collection.booking_month)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Due Date</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatDate(collection.first_milestone_due_date)}</span>
                  {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                </div>
              </div>
              {collection.deal?.linked_to_impl && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Linked to Impl</span>
                  <Badge variant="outline">100% on Collection</Badge>
                </div>
              )}
            </div>

            {/* Clawback Warning */}
            {isOverdue && !isClawedBack && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Collection Overdue</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This deal has passed its collection due date. You can mark it as collected if payment was received, or trigger a clawback.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={handleTriggerClawback}
                    disabled={clawbackMutation.isPending}
                  >
                    {clawbackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Trigger Clawback
                  </Button>
                </div>
              </div>
            )}

            {/* Clawback Triggered */}
            {isClawedBack && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Clawback Triggered</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Amount: {formatCurrency(collection.clawback_amount_usd)}
                    <br />
                    Date: {collection.clawback_triggered_at ? formatDate(collection.clawback_triggered_at) : "-"}
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            {!isClawedBack && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="is_collected"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Collection Received</FormLabel>
                          <FormDescription>
                            Mark this deal as collected when payment is received.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isCollected && (
                    <>
                      <FormField
                        control={form.control}
                        name="collection_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collection Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="collection_amount_usd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collection Amount (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter amount collected"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormDescription>
                              Leave blank to use the full deal value
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes about this collection..."
                            className="resize-none"
                            rows={2}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
