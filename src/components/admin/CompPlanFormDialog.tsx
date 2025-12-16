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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const compPlanSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(100, "Plan name must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional().nullable(),
  is_active: z.boolean(),
});

type CompPlanFormValues = z.infer<typeof compPlanSchema>;

interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface CompPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: CompPlan | null;
  onSubmit: (values: CompPlanFormValues) => void;
  isSubmitting: boolean;
}

export function CompPlanFormDialog({
  open,
  onOpenChange,
  plan,
  onSubmit,
  isSubmitting,
}: CompPlanFormDialogProps) {
  const isEditing = !!plan;

  const form = useForm<CompPlanFormValues>({
    resolver: zodResolver(compPlanSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (plan) {
      form.reset({
        name: plan.name,
        description: plan.description || "",
        is_active: plan.is_active,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        is_active: true,
      });
    }
  }, [plan, form]);

  const handleSubmit = (values: CompPlanFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Compensation Plan" : "Create New Plan"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the compensation plan details."
              : "Create a new compensation plan with metrics and multipliers."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Hunter 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the compensation plan..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description of the plan's purpose and structure.
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
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Active plans can be assigned to users.
                    </FormDescription>
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
                {isEditing ? "Save Changes" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
