import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

const LOGIC_TYPES = [
  { value: "Linear", label: "Linear", description: "Direct proportional payout" },
  { value: "Gated_Threshold", label: "Gated Threshold", description: "Minimum achievement required for any payout" },
  { value: "Stepped_Accelerator", label: "Stepped Accelerator", description: "Tiered multipliers based on achievement" },
] as const;

const metricSchema = z.object({
  metric_name: z.string().trim().min(1, "Metric name is required").max(100, "Max 100 characters"),
  weightage_percent: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
  logic_type: z.enum(["Linear", "Gated_Threshold", "Stepped_Accelerator"]),
  gate_threshold_percent: z.coerce.number().min(0).max(100).nullable().optional(),
  payout_on_booking_pct: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
  payout_on_collection_pct: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
  payout_on_year_end_pct: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
}).refine((data) => data.payout_on_booking_pct + data.payout_on_collection_pct + data.payout_on_year_end_pct === 100, {
  message: "Booking, Collection, and Year End percentages must sum to 100%",
  path: ["payout_on_year_end_pct"],
});

type MetricFormValues = z.infer<typeof metricSchema>;

export interface PlanMetric {
  id: string;
  plan_id: string;
  metric_name: string;
  weightage_percent: number;
  logic_type: "Linear" | "Gated_Threshold" | "Stepped_Accelerator";
  gate_threshold_percent: number | null;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  payout_on_year_end_pct: number;
  created_at: string;
}

interface MetricFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric?: PlanMetric | null;
  onSubmit: (values: MetricFormValues) => void;
  isSubmitting: boolean;
  existingWeightage: number; // Total weightage of other metrics
}

export function MetricFormDialog({
  open,
  onOpenChange,
  metric,
  onSubmit,
  isSubmitting,
  existingWeightage,
}: MetricFormDialogProps) {
  const isEditing = !!metric;
  const maxWeightage = 100 - existingWeightage;

  const form = useForm<MetricFormValues>({
    resolver: zodResolver(metricSchema),
    defaultValues: {
      metric_name: "",
      weightage_percent: 0,
      logic_type: "Linear",
      gate_threshold_percent: null,
      payout_on_booking_pct: 70,
      payout_on_collection_pct: 25,
      payout_on_year_end_pct: 5,
    },
  });

  const logicType = form.watch("logic_type");
  const bookingPct = form.watch("payout_on_booking_pct");
  const collectionPct = form.watch("payout_on_collection_pct");
  const yearEndPct = form.watch("payout_on_year_end_pct");
  const payoutSum = (bookingPct || 0) + (collectionPct || 0) + (yearEndPct || 0);

  useEffect(() => {
    if (metric) {
      form.reset({
        metric_name: metric.metric_name,
        weightage_percent: metric.weightage_percent,
        logic_type: metric.logic_type,
        gate_threshold_percent: metric.gate_threshold_percent,
        payout_on_booking_pct: metric.payout_on_booking_pct ?? 70,
        payout_on_collection_pct: metric.payout_on_collection_pct ?? 25,
        payout_on_year_end_pct: metric.payout_on_year_end_pct ?? 5,
      });
    } else {
      form.reset({
        metric_name: "",
        weightage_percent: Math.min(maxWeightage, 50),
        logic_type: "Linear",
        gate_threshold_percent: null,
        payout_on_booking_pct: 70,
        payout_on_collection_pct: 25,
        payout_on_year_end_pct: 5,
      });
    }
  }, [metric, form, maxWeightage]);

  const handleSubmit = (values: MetricFormValues) => {
    // Clear gate threshold if not using gated logic
    if (values.logic_type !== "Gated_Threshold") {
      values.gate_threshold_percent = null;
    }
    onSubmit(values);
  };

  // Auto-adjust third field when two are changed
  const handleBookingChange = (value: number) => {
    const newBooking = Math.min(100, Math.max(0, value || 0));
    form.setValue("payout_on_booking_pct", newBooking);
    
    const remaining = 100 - newBooking;
    const currentCollection = form.getValues("payout_on_collection_pct") || 0;
    
    if (currentCollection > remaining) {
      form.setValue("payout_on_collection_pct", remaining);
      form.setValue("payout_on_year_end_pct", 0);
    } else {
      form.setValue("payout_on_year_end_pct", remaining - currentCollection);
    }
  };

  const handleCollectionChange = (value: number) => {
    const newCollection = Math.min(100, Math.max(0, value || 0));
    form.setValue("payout_on_collection_pct", newCollection);
    
    const booking = form.getValues("payout_on_booking_pct") || 0;
    const remaining = 100 - booking - newCollection;
    
    if (remaining >= 0) {
      form.setValue("payout_on_year_end_pct", remaining);
    } else {
      // Reduce booking to make room
      const newBooking = Math.max(0, booking + remaining);
      form.setValue("payout_on_booking_pct", newBooking);
      form.setValue("payout_on_year_end_pct", 0);
    }
  };

  const handleYearEndChange = (value: number) => {
    const newYearEnd = Math.min(100, Math.max(0, value || 0));
    form.setValue("payout_on_year_end_pct", newYearEnd);
    
    const booking = form.getValues("payout_on_booking_pct") || 0;
    const remaining = 100 - booking - newYearEnd;
    
    if (remaining >= 0) {
      form.setValue("payout_on_collection_pct", remaining);
    } else {
      // Reduce booking to make room
      const newBooking = Math.max(0, booking + remaining);
      form.setValue("payout_on_booking_pct", newBooking);
      form.setValue("payout_on_collection_pct", 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Metric" : "Add Metric"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the metric configuration."
              : "Add a new metric to this compensation plan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="metric_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metric Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., New Software Booking ARR" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="weightage_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weightage (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={maxWeightage}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Available: {maxWeightage}% (Total must equal 100%)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logic_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logic Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select logic type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOGIC_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <span className="font-medium">{type.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              - {type.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {logicType === "Gated_Threshold" && (
              <FormField
                control={form.control}
                name="gate_threshold_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gate Threshold (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="e.g., 85"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum achievement required for any payout (e.g., 85% means zero payout below 85%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Payout Split Section */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Payout Split</h4>
                {payoutSum !== 100 && (
                  <div className="flex items-center gap-1 text-warning text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Must sum to 100% (currently {payoutSum}%)</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="payout_on_booking_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Upon Bookings (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => handleBookingChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Paid immediately</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payout_on_collection_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Upon Collections (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => handleCollectionChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Held until collected</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payout_on_year_end_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">At Year End (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => handleYearEndChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Released in December</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Add Metric"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
