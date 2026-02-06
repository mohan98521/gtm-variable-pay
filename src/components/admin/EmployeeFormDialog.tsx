import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const SALES_FUNCTIONS = [
  "Farmer",
  "Hunter",
  "CSM",
  "Channel Sales",
  "Sales Engineering",
  "Sales Head - Farmer",
  "Sales Head - Hunter",
  "Farmer - Retain",
  "IMAL Product SE",
  "Insurance Product SE",
  "APAC Regional SE",
  "MEA Regional SE",
  "Sales Engineering - Head",
] as const;

const CURRENCIES = ["USD", "INR", "AED", "SGD", "EUR", "GBP"] as const;

// Full 26-field schema matching bulk upload
const employeeFormSchema = z.object({
  // Core fields (17)
  employee_id: z.string().trim().min(1, "Employee ID is required").max(20, "Max 20 characters"),
  full_name: z.string().trim().min(1, "Full name is required").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Max 255 characters"),
  designation: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  sales_function: z.string().optional().nullable(),
  business_unit: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  group_name: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  function_area: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  manager_employee_id: z.string().trim().max(20, "Max 20 characters").optional().nullable(),
  date_of_hire: z.string().optional().nullable(),
  city: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  country: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  local_currency: z.string().default("USD"),
  department: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  region: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  departure_date: z.string().optional().nullable(),
  // Compensation fields (9)
  employee_role: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  incentive_type: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  target_bonus_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  tfp_local_currency: z.coerce.number().min(0).optional().nullable(),
  tvp_local_currency: z.coerce.number().min(0).optional().nullable(),
  ote_local_currency: z.coerce.number().min(0).optional().nullable(),
  tfp_usd: z.coerce.number().min(0).optional().nullable(),
  tvp_usd: z.coerce.number().min(0).optional().nullable(),
  ote_usd: z.coerce.number().min(0).optional().nullable(),
});

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface Employee {
  id: string;
  employee_id: string;
  email: string;
  full_name: string;
  designation: string | null;
  country: string | null;
  city: string | null;
  date_of_hire: string | null;
  departure_date: string | null;
  group_name: string | null;
  business_unit: string | null;
  function_area: string | null;
  sales_function: string | null;
  local_currency: string;
  manager_employee_id: string | null;
  department: string | null;
  region: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  // Compensation fields
  employee_role: string | null;
  incentive_type: string | null;
  target_bonus_percent: number | null;
  tfp_local_currency: number | null;
  tvp_local_currency: number | null;
  ote_local_currency: number | null;
  tfp_usd: number | null;
  tvp_usd: number | null;
  ote_usd: number | null;
}

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSubmit,
  isSubmitting,
}: EmployeeFormDialogProps) {
  const isEditing = !!employee;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employee_id: "",
      full_name: "",
      email: "",
      designation: "",
      sales_function: "",
      business_unit: "",
      group_name: "",
      function_area: "",
      manager_employee_id: "",
      date_of_hire: "",
      city: "",
      country: "",
      local_currency: "USD",
      department: "",
      region: "",
      departure_date: "",
      employee_role: "",
      incentive_type: "",
      target_bonus_percent: null,
      tfp_local_currency: null,
      tvp_local_currency: null,
      ote_local_currency: null,
      tfp_usd: null,
      tvp_usd: null,
      ote_usd: null,
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        email: employee.email,
        designation: employee.designation || "",
        sales_function: employee.sales_function || "",
        business_unit: employee.business_unit || "",
        group_name: employee.group_name || "",
        function_area: employee.function_area || "",
        manager_employee_id: employee.manager_employee_id || "",
        date_of_hire: employee.date_of_hire || "",
        city: employee.city || "",
        country: employee.country || "",
        local_currency: employee.local_currency || "USD",
        department: employee.department || "",
        region: employee.region || "",
        departure_date: employee.departure_date || "",
        employee_role: employee.employee_role || "",
        incentive_type: employee.incentive_type || "",
        target_bonus_percent: employee.target_bonus_percent,
        tfp_local_currency: employee.tfp_local_currency,
        tvp_local_currency: employee.tvp_local_currency,
        ote_local_currency: employee.ote_local_currency,
        tfp_usd: employee.tfp_usd,
        tvp_usd: employee.tvp_usd,
        ote_usd: employee.ote_usd,
      });
    } else {
      form.reset({
        employee_id: "",
        full_name: "",
        email: "",
        designation: "",
        sales_function: "",
        business_unit: "",
        group_name: "",
        function_area: "",
        manager_employee_id: "",
        date_of_hire: "",
        city: "",
        country: "",
        local_currency: "USD",
        department: "",
        region: "",
        departure_date: "",
        employee_role: "",
        incentive_type: "",
        target_bonus_percent: null,
        tfp_local_currency: null,
        tvp_local_currency: null,
        ote_local_currency: null,
        tfp_usd: null,
        tvp_usd: null,
        ote_usd: null,
      });
    }
  }, [employee, form]);

  const handleSubmit = async (data: EmployeeFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update employee details including role movements and organizational changes."
              : "Add a new employee to the organization with all 26 fields."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Section 1: Basic Info */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DU01464" {...field} disabled={isEditing} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@azentio.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Sales Manager" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 2: Location */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Location</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Mumbai" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="India" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="APAC" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 3: Organization */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Organization</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="business_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="Banking Solutions" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="function_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Function Area</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="group_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="APAC Sales Team" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 4: Sales & Reporting */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Sales & Reporting</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sales_function"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Function</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={SALES_FUNCTIONS.map((func) => ({
                            value: func,
                            label: func,
                          }))}
                          placeholder="Select sales function"
                          searchPlaceholder="Search functions..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="manager_employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager Employee ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DU01234" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 5: Dates */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Employment Dates</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date_of_hire"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departure_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Working Day</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section 6: Compensation */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Compensation</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="local_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "USD"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr} value={curr}>
                              {curr}
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
                  name="employee_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee Role</FormLabel>
                      <FormControl>
                        <Input placeholder="Individual Contributor" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="incentive_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incentive Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Standard" {...field} value={field.value || ""} />
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
                        <Input 
                          type="number" 
                          placeholder="20" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="tfp_local_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TFP (Local Currency)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="80000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
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
                      <FormLabel>TVP (Local Currency)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="20000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
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
                      <FormLabel>OTE (Local Currency)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="100000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="tfp_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TFP (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="80000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tvp_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TVP (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="20000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
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
                        <Input 
                          type="number" 
                          placeholder="100000" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {isEditing ? "Updating..." : "Adding..."}
                  </>
                ) : isEditing ? (
                  "Update Employee"
                ) : (
                  "Add Employee"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
