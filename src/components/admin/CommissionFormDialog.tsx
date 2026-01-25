import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { PlanCommission, PREDEFINED_COMMISSION_TYPES } from "@/hooks/usePlanCommissions";

const CUSTOM_TYPE_OPTION = "__custom__";

const formSchema = z.object({
  commission_type: z.string().min(1, "Commission type is required"),
  custom_type_name: z.string().optional(),
  commission_rate_pct: z.coerce
    .number()
    .min(0, "Rate must be at least 0%")
    .max(100, "Rate cannot exceed 100%"),
  min_threshold_usd: z.coerce.number().nullable().optional(),
  is_active: z.boolean().default(true),
}).refine((data) => {
  if (data.commission_type === CUSTOM_TYPE_OPTION) {
    return data.custom_type_name && data.custom_type_name.trim().length >= 2;
  }
  return true;
}, {
  message: "Custom type name must be at least 2 characters",
  path: ["custom_type_name"],
});

type FormValues = z.infer<typeof formSchema>;

interface CommissionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commission: PlanCommission | null;
  existingTypes: string[];
  onSubmit: (values: FormValues) => void;
  isSubmitting: boolean;
}

export function CommissionFormDialog({
  open,
  onOpenChange,
  commission,
  existingTypes,
  onSubmit,
  isSubmitting,
}: CommissionFormDialogProps) {
  const isEditing = !!commission;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      commission_type: "",
      custom_type_name: "",
      commission_rate_pct: 0,
      min_threshold_usd: null,
      is_active: true,
    },
  });

  const watchedType = form.watch("commission_type");
  const isCustomType = watchedType === CUSTOM_TYPE_OPTION;

  useEffect(() => {
    if (open) {
      if (commission) {
        // Check if editing a custom type (not in predefined list)
        const isPredefined = PREDEFINED_COMMISSION_TYPES.includes(commission.commission_type as any);
        form.reset({
          commission_type: isPredefined ? commission.commission_type : CUSTOM_TYPE_OPTION,
          custom_type_name: isPredefined ? "" : commission.commission_type,
          commission_rate_pct: commission.commission_rate_pct,
          min_threshold_usd: commission.min_threshold_usd,
          is_active: commission.is_active,
        });
      } else {
        form.reset({
          commission_type: "",
          custom_type_name: "",
          commission_rate_pct: 0,
          min_threshold_usd: null,
          is_active: true,
        });
      }
    }
  }, [open, commission, form]);

  // Available predefined types (excluding already used ones when adding new)
  const availableTypes = isEditing
    ? [...PREDEFINED_COMMISSION_TYPES]
    : PREDEFINED_COMMISSION_TYPES.filter((type) => !existingTypes.includes(type));

  const handleSubmit = (values: FormValues) => {
    // Resolve the actual commission type name
    const finalType = values.commission_type === CUSTOM_TYPE_OPTION
      ? values.custom_type_name?.trim() || ""
      : values.commission_type;
    
    // Check for duplicate custom type name
    if (values.commission_type === CUSTOM_TYPE_OPTION && existingTypes.includes(finalType)) {
      form.setError("custom_type_name", { message: "This commission type already exists" });
      return;
    }
    
    onSubmit({
      ...values,
      commission_type: finalType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Commission" : "Add Commission Type"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the commission rate and threshold settings."
              : "Configure a new commission type for this plan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="commission_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                      {!isEditing && (
                        <SelectItem value={CUSTOM_TYPE_OPTION}>
                          Other (custom)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCustomType && (
              <FormField
                control={form.control}
                name="custom_type_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Commission Type Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter custom type name..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter a unique name for this commission type.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="commission_rate_pct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Rate (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Percentage of TCV paid as commission. Use 0 as a placeholder.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="min_threshold_usd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Threshold (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      placeholder="Optional"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? null : parseFloat(value));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum deal value required to qualify for commission (e.g., $50,000 for Perpetual License).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Commission will only apply when active.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Add Commission"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
