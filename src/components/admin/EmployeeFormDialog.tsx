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
import { Loader2 } from "lucide-react";

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

const employeeFormSchema = z.object({
  employee_id: z.string().trim().min(1, "Employee ID is required").max(20, "Max 20 characters"),
  full_name: z.string().trim().min(1, "Full name is required").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Max 255 characters"),
  designation: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  country: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  city: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  date_of_hire: z.string().optional().nullable(),
  group_name: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  business_unit: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  function_area: z.string().trim().max(100, "Max 100 characters").optional().nullable(),
  sales_function: z.string().optional().nullable(),
  local_currency: z.string().default("USD"),
  manager_employee_id: z.string().trim().max(20, "Max 20 characters").optional().nullable(),
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
  group_name: string | null;
  business_unit: string | null;
  function_area: string | null;
  sales_function: string | null;
  local_currency: string;
  manager_employee_id: string | null;
  auth_user_id: string | null;
  is_active: boolean;
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
      country: "",
      city: "",
      date_of_hire: "",
      group_name: "",
      business_unit: "",
      function_area: "",
      sales_function: "",
      local_currency: "USD",
      manager_employee_id: "",
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        email: employee.email,
        designation: employee.designation || "",
        country: employee.country || "",
        city: employee.city || "",
        date_of_hire: employee.date_of_hire || "",
        group_name: employee.group_name || "",
        business_unit: employee.business_unit || "",
        function_area: employee.function_area || "",
        sales_function: employee.sales_function || "",
        local_currency: employee.local_currency || "USD",
        manager_employee_id: employee.manager_employee_id || "",
      });
    } else {
      form.reset({
        employee_id: "",
        full_name: "",
        email: "",
        designation: "",
        country: "",
        city: "",
        date_of_hire: "",
        group_name: "",
        business_unit: "",
        function_area: "",
        sales_function: "",
        local_currency: "USD",
        manager_employee_id: "",
      });
    }
  }, [employee, form]);

  const handleSubmit = async (data: EmployeeFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update employee details including role movements and organizational changes."
              : "Add a new employee to the organization."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Employee ID */}
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

              {/* Full Name */}
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

              {/* Email */}
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

              {/* Designation */}
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

              {/* Sales Function */}
              <FormField
                control={form.control}
                name="sales_function"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Function</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales function" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SALES_FUNCTIONS.map((func) => (
                          <SelectItem key={func} value={func}>
                            {func}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Local Currency */}
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

              {/* Country */}
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

              {/* City */}
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

              {/* Date of Hire */}
              <FormField
                control={form.control}
                name="date_of_hire"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Hire</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Manager Employee ID */}
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

              {/* Business Unit */}
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

              {/* Function Area */}
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

              {/* Group Name */}
              <FormField
                control={form.control}
                name="group_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="APAC Sales Team" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
