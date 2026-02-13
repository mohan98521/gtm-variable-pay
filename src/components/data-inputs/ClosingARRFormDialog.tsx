import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ClosingARRActual,
  ClosingARRInsert,
  useCreateClosingARR,
  useUpdateClosingARR,
  ORDER_CATEGORY_2_OPTIONS,
} from "@/hooks/useClosingARR";
import { useProfiles } from "@/hooks/useProfiles";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { format } from "date-fns";

const formSchema = z.object({
  month_year: z.string().min(1, "Month is required"),
  bu: z.string().min(1, "Business Unit is required"),
  product: z.string().min(1, "Product is required"),
  pid: z.string().min(1, "PID is required"),
  customer_code: z.string().min(1, "Customer Code is required"),
  customer_name: z.string().min(1, "Customer Name is required"),
  order_category: z.string().optional(),
  status: z.string().optional(),
  order_category_2: z.string().optional(),
  opening_arr: z.coerce.number().default(0),
  cr: z.coerce.number().default(0),
  als_others: z.coerce.number().default(0),
  new: z.coerce.number().default(0),
  inflation: z.coerce.number().default(0),
  discount_decrement: z.coerce.number().default(0),
  churn: z.coerce.number().default(0),
  adjustment: z.coerce.number().default(0),
  country: z.string().optional(),
  revised_region: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  renewal_status: z.string().optional(),
  sales_rep_employee_id: z.string().optional(),
  sales_rep_name: z.string().optional(),
  sales_head_employee_id: z.string().optional(),
  sales_head_name: z.string().optional(),
  is_multi_year: z.boolean().default(false),
  renewal_years: z.coerce.number().min(1).default(1),
});

type FormValues = z.infer<typeof formSchema>;

interface ClosingARRFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: ClosingARRActual | null;
  defaultMonth?: string;
}

export function ClosingARRFormDialog({
  open,
  onOpenChange,
  record,
  defaultMonth,
}: ClosingARRFormDialogProps) {
  const { selectedYear, getMonthsForYear } = useFiscalYear();
  const monthOptions = useMemo(() => getMonthsForYear(selectedYear), [selectedYear, getMonthsForYear]);
  const { data: employees = [] } = useProfiles();
  const createMutation = useCreateClosingARR();
  const updateMutation = useUpdateClosingARR();

  const isEditing = !!record;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      month_year: defaultMonth || "",
      bu: "",
      product: "",
      pid: "",
      customer_code: "",
      customer_name: "",
      order_category: "",
      status: "",
      order_category_2: "",
      opening_arr: 0,
      cr: 0,
      als_others: 0,
      new: 0,
      inflation: 0,
      discount_decrement: 0,
      churn: 0,
      adjustment: 0,
      country: "",
      revised_region: "",
      start_date: "",
      end_date: "",
      renewal_status: "",
      sales_rep_employee_id: "",
      sales_rep_name: "",
      sales_head_employee_id: "",
      sales_head_name: "",
      is_multi_year: false,
      renewal_years: 1,
    },
  });

  // Reset form when record changes
  useEffect(() => {
    if (record) {
      form.reset({
        month_year: record.month_year,
        bu: record.bu,
        product: record.product,
        pid: record.pid,
        customer_code: record.customer_code,
        customer_name: record.customer_name,
        order_category: record.order_category || "",
        status: record.status || "",
        order_category_2: record.order_category_2 || "",
        opening_arr: record.opening_arr || 0,
        cr: record.cr || 0,
        als_others: record.als_others || 0,
        new: record.new || 0,
        inflation: record.inflation || 0,
        discount_decrement: record.discount_decrement || 0,
        churn: record.churn || 0,
        adjustment: record.adjustment || 0,
        country: record.country || "",
        revised_region: record.revised_region || "",
        start_date: record.start_date || "",
        end_date: record.end_date || "",
        renewal_status: record.renewal_status || "",
        sales_rep_employee_id: record.sales_rep_employee_id || "",
        sales_rep_name: record.sales_rep_name || "",
        sales_head_employee_id: record.sales_head_employee_id || "",
        sales_head_name: record.sales_head_name || "",
        is_multi_year: (record as any).is_multi_year || false,
        renewal_years: (record as any).renewal_years || 1,
      });
    } else {
      form.reset({
        month_year: defaultMonth || "",
        bu: "",
        product: "",
        pid: "",
        customer_code: "",
        customer_name: "",
        order_category: "",
        status: "",
        order_category_2: "",
        opening_arr: 0,
        cr: 0,
        als_others: 0,
        new: 0,
        inflation: 0,
        discount_decrement: 0,
        churn: 0,
        adjustment: 0,
        country: "",
        revised_region: "",
        start_date: "",
        end_date: "",
        renewal_status: "",
        sales_rep_employee_id: "",
        sales_rep_name: "",
        sales_head_employee_id: "",
        sales_head_name: "",
        is_multi_year: false,
        renewal_years: 1,
      });
    }
  }, [record, defaultMonth, form]);

  // Calculate closing ARR live
  const watchedValues = form.watch([
    "opening_arr",
    "cr",
    "als_others",
    "new",
    "inflation",
    "discount_decrement",
    "churn",
    "adjustment",
  ]);

  const calculatedClosingARR = useMemo(() => {
    const [opening, cr, als, newVal, inflation, discount, churn, adjustment] = watchedValues;
    return (
      (opening || 0) +
      (cr || 0) +
      (als || 0) +
      (newVal || 0) +
      (inflation || 0) -
      (discount || 0) -
      (churn || 0) +
      (adjustment || 0)
    );
  }, [watchedValues]);

  // Auto-populate name when employee ID is selected
  const watchSalesRep = form.watch("sales_rep_employee_id");
  const watchSalesHead = form.watch("sales_head_employee_id");

  useEffect(() => {
    if (watchSalesRep && watchSalesRep !== "_none") {
      const emp = employees.find((e) => e.employee_id === watchSalesRep);
      if (emp) {
        form.setValue("sales_rep_name", emp.full_name);
      }
    } else if (watchSalesRep === "_none" || !watchSalesRep) {
      form.setValue("sales_rep_name", "");
    }
  }, [watchSalesRep, employees, form]);

  useEffect(() => {
    if (watchSalesHead && watchSalesHead !== "_none") {
      const emp = employees.find((e) => e.employee_id === watchSalesHead);
      if (emp) {
        form.setValue("sales_head_name", emp.full_name);
      }
    } else if (watchSalesHead === "_none" || !watchSalesHead) {
      form.setValue("sales_head_name", "");
    }
  }, [watchSalesHead, employees, form]);

  const onSubmit = async (values: FormValues) => {
    const payload: ClosingARRInsert = {
      month_year: values.month_year,
      bu: values.bu,
      product: values.product,
      pid: values.pid,
      customer_code: values.customer_code,
      customer_name: values.customer_name,
      order_category: values.order_category || null,
      status: values.status || null,
      order_category_2: values.order_category_2 || null,
      opening_arr: values.opening_arr,
      cr: values.cr,
      als_others: values.als_others,
      new: values.new,
      inflation: values.inflation,
      discount_decrement: values.discount_decrement,
      churn: values.churn,
      adjustment: values.adjustment,
      country: values.country || null,
      revised_region: values.revised_region || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      renewal_status: values.renewal_status || null,
      sales_rep_employee_id: values.sales_rep_employee_id === "_none" ? null : values.sales_rep_employee_id || null,
      sales_rep_name: values.sales_rep_name || null,
      sales_head_employee_id: values.sales_head_employee_id === "_none" ? null : values.sales_head_employee_id || null,
      sales_head_name: values.sales_head_name || null,
      is_multi_year: values.is_multi_year,
      renewal_years: values.is_multi_year ? values.renewal_years : 1,
    } as any;

    try {
      if (isEditing && record) {
        await updateMutation.mutateAsync({ id: record.id, updates: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Closing ARR Record" : "Add Closing ARR Record"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Section 1: Project Identity */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Project Identity</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="month_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {monthOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                    name="bu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Unit *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., MEA" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="product"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Core Banking" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="pid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PID *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Project ID" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customer_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Code *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Customer code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Customer name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section 2: Classification */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="order_category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Order category" />
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
                        <FormControl>
                          <Input {...field} placeholder="Status" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="order_category_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Type</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          value={field.value || "_none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {ORDER_CATEGORY_2_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="revised_region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revised Region</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Region" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section 3: ARR Components */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">ARR Components (USD)</h3>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Closing ARR:</span>
                        <Badge variant="default" className="text-base font-semibold">
                          {formatCurrency(calculatedClosingARR)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="opening_arr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening ARR</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CR (+)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="als_others"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ALS + Others (+)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="new"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New (+)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="inflation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inflation (+)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount_decrement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount/Decrement (−)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="churn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Churn (−)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adjustment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adjustment (±)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section: Multi-Year Renewal */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Multi-Year Renewal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="is_multi_year"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Multi-Year Renewal</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Is this a multi-year renewal contract?
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch("is_multi_year") && (
                    <FormField
                      control={form.control}
                      name="renewal_years"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>No. of Renewal Years</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} step={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <Separator />

              {/* Section 4: Contract Dates */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Contract Dates</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="renewal_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renewal Status</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Renewal status" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Section 5: Participants */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Participants</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sales_rep_employee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Rep</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          value={field.value || "_none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sales rep" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {employees
                              .filter((emp) => emp.employee_id)
                              .map((emp) => (
                                <SelectItem key={emp.employee_id} value={emp.employee_id!}>
                                  {emp.full_name} ({emp.employee_id})
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
                    name="sales_head_employee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Head</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          value={field.value || "_none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sales head" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {employees
                              .filter((emp) => emp.employee_id)
                              .map((emp) => (
                                <SelectItem key={emp.employee_id} value={emp.employee_id!}>
                                  {emp.full_name} ({emp.employee_id})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : isEditing ? "Update Record" : "Add Record"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
