import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { DealParticipantsEditor } from "./DealParticipantsEditor";
import {
  DealWithParticipants,
  METRIC_TYPES,
  BUSINESS_UNITS,
  DEAL_STATUSES,
  useCreateDeal,
  useUpdateDeal,
  generateDealId,
} from "@/hooks/useDeals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

const dealFormSchema = z.object({
  deal_id: z.string().min(1, "Deal ID is required"),
  deal_name: z.string().min(1, "Deal name is required"),
  client_name: z.string().min(1, "Client name is required"),
  metric_type: z.string().min(1, "Metric type is required"),
  business_unit: z.string().min(1, "Business unit is required"),
  month_year: z.string().min(1, "Month is required"),
  deal_value_usd: z.coerce.number().min(0, "Value must be positive"),
  deal_value_local: z.coerce.number().optional(),
  local_currency: z.string().default("USD"),
  status: z.string().default("draft"),
  notes: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealFormSchema>;

interface Participant {
  employee_id: string;
  participant_role: string;
  split_percent: number;
}

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: DealWithParticipants | null;
  defaultMetricType?: string;
  defaultMonth?: string;
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  defaultMetricType,
  defaultMonth,
}: DealFormDialogProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const isEditing = !!deal;
  const { selectedYear, getMonthsForYear } = useFiscalYear();

  // Get months for the current fiscal year
  const monthOptions = useMemo(() => getMonthsForYear(selectedYear), [selectedYear, getMonthsForYear]);

  // Check if this is a retroactive change (editing past period)
  const isRetroactiveChange = useMemo(() => {
    if (!isEditing || !deal) return false;
    const currentPeriod = new Date();
    currentPeriod.setDate(1);
    currentPeriod.setHours(0, 0, 0, 0);
    const dealDate = new Date(deal.month_year);
    return dealDate < currentPeriod;
  }, [isEditing, deal]);

  // Fetch employees for the participant dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      deal_id: "",
      deal_name: "",
      client_name: "",
      metric_type: defaultMetricType || "",
      business_unit: "",
      month_year: defaultMonth || format(new Date(), "yyyy-MM-01"),
      deal_value_usd: 0,
      deal_value_local: undefined,
      local_currency: "USD",
      status: "draft",
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or deal changes
  useEffect(() => {
    if (open) {
      if (deal) {
        form.reset({
          deal_id: deal.deal_id,
          deal_name: deal.deal_name,
          client_name: deal.client_name,
          metric_type: deal.metric_type,
          business_unit: deal.business_unit || "",
          month_year: deal.month_year,
          deal_value_usd: deal.deal_value_usd,
          deal_value_local: deal.deal_value_local || undefined,
          local_currency: deal.local_currency,
          status: deal.status,
          notes: deal.notes || "",
        });
        setParticipants(
          deal.deal_participants.map((p) => ({
            employee_id: p.employee_id,
            participant_role: p.participant_role,
            split_percent: p.split_percent,
          }))
        );
      } else {
        const metricType = defaultMetricType || "software_arr";
        // Use first month of fiscal year if no default
        const defaultMonthValue = defaultMonth || (monthOptions.length > 0 ? monthOptions[new Date().getMonth()]?.value : format(new Date(), "yyyy-MM-01"));
        form.reset({
          deal_id: generateDealId(metricType),
          deal_name: "",
          client_name: "",
          metric_type: metricType,
          business_unit: "",
          month_year: defaultMonthValue,
          deal_value_usd: 0,
          deal_value_local: undefined,
          local_currency: "USD",
          status: "draft",
          notes: "",
        });
        setParticipants([]);
      }
    }
  }, [open, deal, defaultMetricType, defaultMonth, form, monthOptions]);

  // Auto-generate deal ID when metric type changes (only for new deals)
  const watchMetricType = form.watch("metric_type");
  useEffect(() => {
    if (!isEditing && watchMetricType) {
      form.setValue("deal_id", generateDealId(watchMetricType));
    }
  }, [watchMetricType, isEditing, form]);

  const onSubmit = async (values: DealFormValues) => {
    if (isEditing && deal) {
      await updateDeal.mutateAsync({
        id: deal.id,
        ...values,
        participants,
      });
    } else {
      await createDeal.mutateAsync({
        deal_id: values.deal_id,
        deal_name: values.deal_name,
        client_name: values.client_name,
        metric_type: values.metric_type,
        business_unit: values.business_unit,
        month_year: values.month_year,
        deal_value_usd: values.deal_value_usd,
        deal_value_local: values.deal_value_local,
        local_currency: values.local_currency,
        status: values.status,
        notes: values.notes,
        participants,
      });
    }

    onOpenChange(false);
  };

  const isSubmitting = createDeal.isPending || updateDeal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Deal" : "Add New Deal"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update deal details and participant assignments."
              : "Enter deal details and assign team members."}
          </DialogDescription>
        </DialogHeader>

        {/* Retroactive Change Warning */}
        {isRetroactiveChange && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Retroactive Change:</strong> You are editing a deal from a past period. 
              This change will be logged in the audit trail.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal ID</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metric_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METRIC_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="deal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., ERP Implementation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Acme Corp" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="business_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUSINESS_UNITS.map((bu) => (
                          <SelectItem key={bu.value} value={bu.value}>
                            {bu.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="month_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month (FY {selectedYear})</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deal_value_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Value (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEAL_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="deal_value_local"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Value (Local Currency)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
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
                name="local_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional notes about this deal..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <DealParticipantsEditor
                participants={participants}
                employees={employees}
                onChange={setParticipants}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : isEditing
                  ? "Update Deal"
                  : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
