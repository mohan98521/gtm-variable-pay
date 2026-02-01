import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompPlans } from "@/hooks/useCompPlans";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useCreatePlanAssignment, useUpdatePlanAssignment } from "@/hooks/usePlanAssignments";

const formSchema = z.object({
  plan_id: z.string().min(1, "Please select a plan"),
  effective_start_date: z.date({ required_error: "Start date is required" }),
  effective_end_date: z.date({ required_error: "End date is required" }),
  currency: z.string().min(1, "Currency is required"),
  tfp_local_currency: z.coerce.number().min(0).optional(),
  target_bonus_percent: z.coerce.number().min(0).max(100).optional(),
  tvp_local_currency: z.coerce.number().min(0).optional(),
  ote_local_currency: z.coerce.number().min(0).optional(),
  tfp_usd: z.coerce.number().min(0).optional(),
  target_bonus_usd: z.coerce.number().min(0).optional(),
  ote_usd: z.coerce.number().min(0).optional(),
}).refine((data) => data.effective_end_date > data.effective_start_date, {
  message: "End date must be after start date",
  path: ["effective_end_date"],
});

type FormValues = z.infer<typeof formSchema>;

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  local_currency: string;
  tfp_local_currency?: number | null;
  tfp_usd?: number | null;
  target_bonus_percent?: number | null;
  tvp_local_currency?: number | null;
  tvp_usd?: number | null;
  ote_local_currency?: number | null;
  ote_usd?: number | null;
  auth_user_id?: string | null;
}

interface ExistingAssignment {
  id: string;
  plan_id: string;
  effective_start_date: string;
  effective_end_date: string;
  currency: string;
  tfp_local_currency?: number | null;
  target_bonus_percent?: number | null;
  ote_local_currency?: number | null;
  tfp_usd?: number | null;
  target_bonus_usd?: number | null;
  ote_usd?: number | null;
  target_value_annual: number;
}

interface PlanAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  existingAssignment?: ExistingAssignment | null;
  preselectedPlanId?: string;
}

export function PlanAssignmentDialog({
  open,
  onOpenChange,
  employee,
  existingAssignment,
  preselectedPlanId,
}: PlanAssignmentDialogProps) {
  const { selectedYear } = useFiscalYear();
  const { data: plans = [], isLoading: plansLoading } = useCompPlans(selectedYear);
  const createMutation = useCreatePlanAssignment();
  const updateMutation = useUpdatePlanAssignment();
  
  const [hasNoAuthAccount, setHasNoAuthAccount] = useState(false);
  
  const isEditing = !!existingAssignment;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plan_id: "",
      currency: "USD",
      tfp_local_currency: 0,
      target_bonus_percent: 0,
      tvp_local_currency: 0,
      ote_local_currency: 0,
      tfp_usd: 0,
      target_bonus_usd: 0,
      ote_usd: 0,
    },
  });

  // Populate form when employee or existing assignment changes
  useEffect(() => {
    if (!open) return;

    if (existingAssignment) {
      // Editing mode - use existing assignment values
      form.reset({
        plan_id: existingAssignment.plan_id,
        effective_start_date: new Date(existingAssignment.effective_start_date),
        effective_end_date: new Date(existingAssignment.effective_end_date),
        currency: existingAssignment.currency,
        tfp_local_currency: existingAssignment.tfp_local_currency ?? 0,
        target_bonus_percent: existingAssignment.target_bonus_percent ?? 0,
        ote_local_currency: existingAssignment.ote_local_currency ?? 0,
        tfp_usd: existingAssignment.tfp_usd ?? 0,
        target_bonus_usd: existingAssignment.target_bonus_usd ?? 0,
        ote_usd: existingAssignment.ote_usd ?? 0,
      });
    } else if (employee) {
      // Creating mode - populate from employee data
      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31);

      form.reset({
        plan_id: preselectedPlanId || "",
        effective_start_date: startDate,
        effective_end_date: endDate,
        currency: employee.local_currency || "USD",
        tfp_local_currency: employee.tfp_local_currency ?? 0,
        target_bonus_percent: employee.target_bonus_percent ?? 0,
        tvp_local_currency: employee.tvp_local_currency ?? 0,
        ote_local_currency: employee.ote_local_currency ?? 0,
        tfp_usd: employee.tfp_usd ?? 0,
        target_bonus_usd: employee.tvp_usd ?? 0,
        ote_usd: employee.ote_usd ?? 0,
      });

      setHasNoAuthAccount(!employee.auth_user_id);
    }
  }, [open, employee, existingAssignment, selectedYear, preselectedPlanId, form]);

  const onSubmit = async (values: FormValues) => {
    if (!employee) return;

    // Use employee.id as user_id (the UUID from employees table)
    // This assumes employees table id is used in user_targets
    const userId = employee.id;

    const payload = {
      user_id: userId,
      plan_id: values.plan_id,
      effective_start_date: format(values.effective_start_date, "yyyy-MM-dd"),
      effective_end_date: format(values.effective_end_date, "yyyy-MM-dd"),
      target_value_annual: values.ote_usd || 0,
      currency: values.currency,
      target_bonus_percent: values.target_bonus_percent || null,
      tfp_local_currency: values.tfp_local_currency || null,
      ote_local_currency: values.ote_local_currency || null,
      tfp_usd: values.tfp_usd || null,
      target_bonus_usd: values.target_bonus_usd || null,
      ote_usd: values.ote_usd || null,
    };

    if (isEditing && existingAssignment) {
      await updateMutation.mutateAsync({ ...payload, id: existingAssignment.id });
    } else {
      await createMutation.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Plan Assignment" : "Assign Employee to Plan"}
          </DialogTitle>
          <DialogDescription>
            {employee && (
              <span>
                Assign <strong>{employee.full_name}</strong> ({employee.employee_id}) to a compensation plan
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasNoAuthAccount && (
          <Alert variant="default" className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              This employee doesn't have an account yet. The assignment will be created but won't be active until they have an account.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Plan Selection */}
            <FormField
              control={form.control}
              name="plan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Compensation Plan</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plansLoading ? (
                        <SelectItem value="loading" disabled>Loading plans...</SelectItem>
                      ) : plans.length === 0 ? (
                        <SelectItem value="none" disabled>No plans for {selectedYear}</SelectItem>
                      ) : (
                        plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <div className="flex items-center gap-2">
                              {plan.name}
                              {plan.is_active && (
                                <Badge variant="outline" className="text-xs">Active</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Showing plans for fiscal year {selectedYear}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Effective Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effective_start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effective_end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Currency */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="SGD">SGD</SelectItem>
                      <SelectItem value="KES">KES</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="SAR">SAR</SelectItem>
                      <SelectItem value="LBP">LBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Compensation Values - Local Currency */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Local Currency Values</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tfp_local_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TFP (Local)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_bonus_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Bonus %</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tvp_local_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TVP (Local)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ote_local_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OTE (Local)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Compensation Values - USD */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">USD Values</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tfp_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TFP (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_bonus_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Bonus (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ote_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OTE (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
                {isEditing ? "Update Assignment" : "Create Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
