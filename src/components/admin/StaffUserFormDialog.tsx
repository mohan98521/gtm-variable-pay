import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRoles } from "@/hooks/useRoles";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const staffUserSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(100),
  employee_id: z.string().trim().min(1, "Employee ID is required").max(50),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255),
  role: z.string().min(1, "Role is required"),
});

type StaffUserFormValues = z.infer<typeof staffUserSchema>;

interface StaffUserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffUserFormDialog({ open, onOpenChange }: StaffUserFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { roles, isLoading: rolesLoading } = useRoles();

  const SALES_ROLES = ["sales_rep", "sales_head"];
  const staffRoles = roles.filter(r => !SALES_ROLES.includes(r.name));

  const form = useForm<StaffUserFormValues>({
    resolver: zodResolver(staffUserSchema),
    defaultValues: { full_name: "", employee_id: "", email: "", role: "" },
  });

  const onSubmit = async (values: StaffUserFormValues) => {
    setIsSubmitting(true);
    try {
      // Step 1: Insert employee record
      const { error: empError } = await supabase.from("employees").insert({
        employee_id: values.employee_id,
        full_name: values.full_name,
        email: values.email.toLowerCase(),
        is_active: true,
        local_currency: "USD",
      });

      if (empError) {
        toast.error("Failed to create employee record", { description: empError.message });
        setIsSubmitting(false);
        return;
      }

      // Step 2: Create auth account via edge function
      const { data: accountData, error: fnError } = await supabase.functions.invoke(
        "create-employee-account",
        {
          body: {
            employee_id: values.employee_id,
            email: values.email.toLowerCase(),
            full_name: values.full_name,
          },
        }
      );

      if (fnError || accountData?.error) {
        toast.error("Employee created but account creation failed", {
          description: fnError?.message || accountData?.error,
        });
        setIsSubmitting(false);
        return;
      }

      const authUserId = accountData?.user_id;

      // Step 3: Override default role — delete the auto-assigned sales_rep, insert the chosen role
      if (authUserId && values.role !== "sales_rep") {
        await supabase.from("user_roles").delete().eq("user_id", authUserId).eq("role", "sales_rep");
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: authUserId,
          role: values.role,
        });

        if (roleError) {
          toast.error("Account created but role assignment failed", {
            description: roleError.message,
          });
          setIsSubmitting(false);
          return;
        }
      }

      toast.success(`Staff user created: ${values.full_name}`, {
        description: "Temporary password: Welcome@123",
      });

      queryClient.invalidateQueries({ queryKey: ["employees-accounts-all"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Unexpected error", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff User</DialogTitle>
          <DialogDescription>
            Quick onboarding for non-sales staff. Creates employee record, login account, and assigns role in one step.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. AZ-1234" {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@company.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={rolesLoading ? "Loading roles…" : "Select a role"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staffRoles.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Staff User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
