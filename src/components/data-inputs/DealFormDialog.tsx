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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { DealParticipantsEditor } from "./DealParticipantsEditor";
import {
  DealWithParticipants,
  PROPOSAL_TYPES,
  DEAL_STATUSES,
  useCreateDeal,
  useUpdateDeal,
  generateProjectId,
} from "@/hooks/useDeals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useSupportTeams, SupportTeamWithMembers } from "@/hooks/useSupportTeams";

const dealFormSchema = z.object({
  project_id: z.string().min(1, "Project ID is required"),
  customer_code: z.string().min(1, "Customer code is required"),
  customer_name: z.string().optional(),
  region: z.string().min(1, "Region is required"),
  country: z.string().min(1, "Country is required"),
  bu: z.string().min(1, "Business unit is required"),
  product: z.string().min(1, "Product is required"),
  type_of_proposal: z.string().min(1, "Type of proposal is required"),
  gp_margin_percent: z.coerce.number().min(0).max(100).optional(),
  month_year: z.string().min(1, "Month is required"),
  first_year_amc_usd: z.coerce.number().min(0).optional(),
  first_year_subscription_usd: z.coerce.number().min(0).optional(),
  managed_services_usd: z.coerce.number().min(0).optional(),
  implementation_usd: z.coerce.number().min(0).optional(),
  cr_usd: z.coerce.number().min(0).optional(),
  er_usd: z.coerce.number().min(0).optional(),
  tcv_usd: z.coerce.number().min(0).optional(),
  perpetual_license_usd: z.coerce.number().min(0).optional(),
  sales_rep_employee_id: z.string().optional(),
  sales_head_employee_id: z.string().optional(),
  sales_engineering_employee_id: z.string().optional(),
  sales_engineering_head_employee_id: z.string().optional(),
  solution_manager_employee_id: z.string().optional(),
  linked_to_impl: z.boolean().default(false),
  eligible_for_perpetual_incentive: z.boolean().default(false),
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
  defaultProposalType?: string;
  defaultMonth?: string;
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  defaultProposalType,
  defaultMonth,
}: DealFormDialogProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [seTeamMode, setSeTeamMode] = useState(false);
  const [smTeamMode, setSmTeamMode] = useState(false);
  const [seTeamId, setSeTeamId] = useState<string>("");
  const [smTeamId, setSmTeamId] = useState<string>("");
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const isEditing = !!deal;
  const { selectedYear, getMonthsForYear } = useFiscalYear();
  const { teams: supportTeams } = useSupportTeams();

  const monthOptions = useMemo(() => getMonthsForYear(selectedYear), [selectedYear, getMonthsForYear]);

  const isRetroactiveChange = useMemo(() => {
    if (!isEditing || !deal) return false;
    const currentPeriod = new Date();
    currentPeriod.setDate(1);
    currentPeriod.setHours(0, 0, 0, 0);
    const dealDate = new Date(deal.month_year);
    return dealDate < currentPeriod;
  }, [isEditing, deal]);

  // Fetch employees for lookups
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

  const getEmployeeName = (employeeId: string | undefined | null) => {
    if (!employeeId) return "";
    const employee = employees.find((e) => e.employee_id === employeeId);
    return employee?.full_name || "";
  };

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      project_id: "",
      customer_code: "",
      customer_name: "",
      region: "",
      country: "",
      bu: "",
      product: "",
      type_of_proposal: defaultProposalType || "",
      gp_margin_percent: undefined,
      month_year: defaultMonth || format(new Date(), "yyyy-MM-01"),
      first_year_amc_usd: 0,
      first_year_subscription_usd: 0,
      managed_services_usd: 0,
      implementation_usd: 0,
      cr_usd: 0,
      er_usd: 0,
      tcv_usd: 0,
      perpetual_license_usd: 0,
      sales_rep_employee_id: "",
      sales_head_employee_id: "",
      sales_engineering_employee_id: "",
      sales_engineering_head_employee_id: "",
      solution_manager_employee_id: "",
      linked_to_impl: false,
      eligible_for_perpetual_incentive: false,
      status: "draft",
      notes: "",
    },
  });

  // Watch AMC and Subscription for auto-calculation
  const watchAmc = form.watch("first_year_amc_usd") || 0;
  const watchSubscription = form.watch("first_year_subscription_usd") || 0;
  const calculatedARR = watchAmc + watchSubscription;

  // Reset form when dialog opens/closes or deal changes
  useEffect(() => {
    if (open) {
      if (deal) {
        form.reset({
          project_id: deal.project_id,
          customer_code: deal.customer_code,
          customer_name: (deal as any).customer_name || "",
          region: deal.region,
          country: deal.country,
          bu: deal.bu,
          product: deal.product,
          type_of_proposal: deal.type_of_proposal,
          gp_margin_percent: deal.gp_margin_percent || undefined,
          month_year: deal.month_year,
          first_year_amc_usd: deal.first_year_amc_usd || 0,
          first_year_subscription_usd: deal.first_year_subscription_usd || 0,
          managed_services_usd: deal.managed_services_usd || 0,
          implementation_usd: deal.implementation_usd || 0,
          cr_usd: deal.cr_usd || 0,
          er_usd: deal.er_usd || 0,
          tcv_usd: deal.tcv_usd || 0,
          perpetual_license_usd: (deal as any).perpetual_license_usd || 0,
          sales_rep_employee_id: deal.sales_rep_employee_id || "",
          sales_head_employee_id: deal.sales_head_employee_id || "",
          sales_engineering_employee_id: deal.sales_engineering_employee_id || "",
          sales_engineering_head_employee_id: deal.sales_engineering_head_employee_id || "",
          solution_manager_employee_id: (deal as any).solution_manager_employee_id || "",
          linked_to_impl: deal.linked_to_impl || false,
          eligible_for_perpetual_incentive: deal.eligible_for_perpetual_incentive || false,
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
        // Check if deal has team assignments
        const dealAny = deal as any;
        if (dealAny.sales_engineering_team_id) {
          setSeTeamMode(true);
          setSeTeamId(dealAny.sales_engineering_team_id);
        } else {
          setSeTeamMode(false);
          setSeTeamId("");
        }
        if (dealAny.solution_manager_team_id) {
          setSmTeamMode(true);
          setSmTeamId(dealAny.solution_manager_team_id);
        } else {
          setSmTeamMode(false);
          setSmTeamId("");
        }
      } else {
        const proposalType = defaultProposalType || "amc";
        const defaultMonthValue = defaultMonth || (monthOptions.length > 0 ? monthOptions[new Date().getMonth()]?.value : format(new Date(), "yyyy-MM-01"));
        form.reset({
          project_id: generateProjectId(),
          customer_code: "",
          customer_name: "",
          region: "",
          country: "",
          bu: "",
          product: "",
          type_of_proposal: proposalType,
          gp_margin_percent: undefined,
          month_year: defaultMonthValue,
          first_year_amc_usd: 0,
          first_year_subscription_usd: 0,
          managed_services_usd: 0,
          implementation_usd: 0,
          cr_usd: 0,
          er_usd: 0,
          tcv_usd: 0,
          perpetual_license_usd: 0,
          sales_rep_employee_id: "",
          sales_head_employee_id: "",
          sales_engineering_employee_id: "",
          sales_engineering_head_employee_id: "",
          solution_manager_employee_id: "",
          linked_to_impl: false,
          eligible_for_perpetual_incentive: false,
          status: "draft",
          notes: "",
        });
        setParticipants([]);
        setSeTeamMode(false);
        setSeTeamId("");
        setSmTeamMode(false);
        setSmTeamId("");
      }
    }
  }, [open, deal, defaultProposalType, defaultMonth, form, monthOptions]);

  const onSubmit = async (values: DealFormValues) => {
    // Build participant names from employee IDs
    const salesRepName = getEmployeeName(values.sales_rep_employee_id);
    const salesHeadName = getEmployeeName(values.sales_head_employee_id);
    const salesEngineeringName = seTeamMode ? "" : getEmployeeName(values.sales_engineering_employee_id);
    const salesEngineeringHeadName = getEmployeeName(values.sales_engineering_head_employee_id);
    const solutionManagerName = smTeamMode ? "" : getEmployeeName(values.solution_manager_employee_id);

    // Build team assignment overrides
    const teamOverrides: Record<string, any> = {};
    if (seTeamMode && seTeamId) {
      teamOverrides.sales_engineering_team_id = seTeamId;
      teamOverrides.sales_engineering_employee_id = null;
      teamOverrides.sales_engineering_name = null;
    } else {
      teamOverrides.sales_engineering_team_id = null;
    }
    if (smTeamMode && smTeamId) {
      teamOverrides.solution_manager_team_id = smTeamId;
      teamOverrides.solution_manager_employee_id = null;
      teamOverrides.solution_manager_name = null;
    } else {
      teamOverrides.solution_manager_team_id = null;
    }

    if (isEditing && deal) {
      await updateDeal.mutateAsync({
        id: deal.id,
        ...values,
        sales_rep_name: salesRepName || undefined,
        sales_head_name: salesHeadName || undefined,
        sales_engineering_name: salesEngineeringName || undefined,
        sales_engineering_head_name: salesEngineeringHeadName || undefined,
        solution_manager_employee_id: smTeamMode ? undefined : (values.solution_manager_employee_id || undefined),
        solution_manager_name: solutionManagerName || undefined,
        participants,
        ...teamOverrides,
      } as any);
    } else {
      await createDeal.mutateAsync({
        project_id: values.project_id,
        customer_code: values.customer_code,
        customer_name: values.customer_name || undefined,
        region: values.region,
        country: values.country,
        bu: values.bu,
        product: values.product,
        type_of_proposal: values.type_of_proposal,
        month_year: values.month_year,
        gp_margin_percent: values.gp_margin_percent,
        first_year_amc_usd: values.first_year_amc_usd,
        first_year_subscription_usd: values.first_year_subscription_usd,
        managed_services_usd: values.managed_services_usd,
        implementation_usd: values.implementation_usd,
        cr_usd: values.cr_usd,
        er_usd: values.er_usd,
        tcv_usd: values.tcv_usd,
        perpetual_license_usd: values.perpetual_license_usd,
        sales_rep_employee_id: values.sales_rep_employee_id || undefined,
        sales_rep_name: salesRepName || undefined,
        sales_head_employee_id: values.sales_head_employee_id || undefined,
        sales_head_name: salesHeadName || undefined,
        sales_engineering_employee_id: seTeamMode ? undefined : (values.sales_engineering_employee_id || undefined),
        sales_engineering_name: salesEngineeringName || undefined,
        sales_engineering_head_employee_id: values.sales_engineering_head_employee_id || undefined,
        sales_engineering_head_name: salesEngineeringHeadName || undefined,
        solution_manager_employee_id: smTeamMode ? undefined : (values.solution_manager_employee_id || undefined),
        solution_manager_name: solutionManagerName || undefined,
        linked_to_impl: values.linked_to_impl,
        eligible_for_perpetual_incentive: values.eligible_for_perpetual_incentive,
        status: values.status,
        notes: values.notes,
        participants,
        ...teamOverrides,
      } as any);
    }

    onOpenChange(false);
  };

  const isSubmitting = createDeal.isPending || updateDeal.isPending;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Deal" : "Add New Deal"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update deal details and participant assignments."
              : "Enter deal details for actuals tracking."}
          </DialogDescription>
        </DialogHeader>

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Deal Identity */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Deal Identity</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project ID</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly={isEditing} placeholder="PRJ-XXX-XXX" />
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
                      <FormLabel>Customer Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., CUST001" />
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
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Acme Bank Ltd" />
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
                      <FormLabel>Product</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Core Banking" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., APAC" />
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
                        <Input {...field} placeholder="e.g., Singapore" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Unit</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Banking, Insurance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 2: Classification */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classification</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="type_of_proposal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Proposal</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROPOSAL_TYPES.map((type) => (
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
                <FormField
                  control={form.control}
                  name="gp_margin_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GP Margin %</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" step="0.1" {...field} value={field.value ?? ""} />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="linked_to_impl"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Linked to Implementation</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eligible_for_perpetual_incentive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Eligible for Perpetual Incentive</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 3: Value Breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Value Breakdown (USD)</h3>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="first_year_amc_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Year AMC</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="first_year_subscription_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Year Subscription</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>New Software Booking ARR</FormLabel>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm font-medium flex items-center">
                    {formatCurrency(calculatedARR)}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-calculated</p>
                </FormItem>
                <FormField
                  control={form.control}
                  name="tcv_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TCV</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="managed_services_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Managed Services</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="implementation_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Implementation</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cr_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CR (Change Request)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="er_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ER (Enhancement Request)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="perpetual_license_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perpetual License</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 4: Participants */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Participants</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sales_rep_employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Rep</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || "_none"}
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          options={[
                            { value: "_none", label: "None" },
                            ...employees.filter(emp => emp.employee_id).map((emp) => ({
                              value: emp.employee_id,
                              label: `${emp.full_name} (${emp.employee_id})`,
                            })),
                          ]}
                          placeholder="Select employee"
                          searchPlaceholder="Search employees..."
                        />
                      </FormControl>
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
                      <FormControl>
                        <SearchableSelect
                          value={field.value || "_none"}
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          options={[
                            { value: "_none", label: "None" },
                            ...employees.filter(emp => emp.employee_id).map((emp) => ({
                              value: emp.employee_id,
                              label: `${emp.full_name} (${emp.employee_id})`,
                            })),
                          ]}
                          placeholder="Select employee"
                          searchPlaceholder="Search employees..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Sales Engineering: Team-or-Individual toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sales Engineering</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{seTeamMode ? "Team" : "Individual"}</span>
                      <Switch checked={seTeamMode} onCheckedChange={(checked) => {
                        setSeTeamMode(checked);
                        if (checked) form.setValue("sales_engineering_employee_id", "");
                        else setSeTeamId("");
                      }} />
                    </div>
                  </div>
                  {seTeamMode ? (
                    <Select value={seTeamId} onValueChange={setSeTeamId}>
                      <SelectTrigger><SelectValue placeholder="Select support team" /></SelectTrigger>
                      <SelectContent>
                        {supportTeams.filter(t => t.team_role === "sales_engineering" && t.is_active).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.team_name} {t.region ? `(${t.region})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormField
                      control={form.control}
                      name="sales_engineering_employee_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <SearchableSelect
                              value={field.value || "_none"}
                              onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                              options={[
                                { value: "_none", label: "None" },
                                ...employees.filter(emp => emp.employee_id).map((emp) => ({
                                  value: emp.employee_id,
                                  label: `${emp.full_name} (${emp.employee_id})`,
                                })),
                              ]}
                              placeholder="Select employee"
                              searchPlaceholder="Search employees..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="sales_engineering_head_employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Engineering Head</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || "_none"}
                          onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                          options={[
                            { value: "_none", label: "None" },
                            ...employees.filter(emp => emp.employee_id).map((emp) => ({
                              value: emp.employee_id,
                              label: `${emp.full_name} (${emp.employee_id})`,
                            })),
                          ]}
                          placeholder="Select employee"
                          searchPlaceholder="Search employees..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Solution Manager ID: Team-or-Individual toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Solution Manager ID</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{smTeamMode ? "Team" : "Individual"}</span>
                      <Switch checked={smTeamMode} onCheckedChange={(checked) => {
                        setSmTeamMode(checked);
                        if (checked) form.setValue("solution_manager_employee_id", "");
                        else setSmTeamId("");
                      }} />
                    </div>
                  </div>
                  {smTeamMode ? (
                    <Select value={smTeamId} onValueChange={setSmTeamId}>
                      <SelectTrigger><SelectValue placeholder="Select support team" /></SelectTrigger>
                      <SelectContent>
                        {supportTeams.filter(t => t.team_role === "solution_manager" && t.is_active).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.team_name} {t.region ? `(${t.region})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormField
                      control={form.control}
                      name="solution_manager_employee_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <SearchableSelect
                              value={field.value || "_none"}
                              onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                              options={[
                                { value: "_none", label: "None" },
                                ...employees.filter(emp => emp.employee_id).map((emp) => ({
                                  value: emp.employee_id,
                                  label: `${emp.full_name} (${emp.employee_id})`,
                                })),
                              ]}
                              placeholder="Select employee"
                              searchPlaceholder="Search employees..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Additional Participants with Splits */}
            <div className="border-t pt-4">
              <DealParticipantsEditor
                participants={participants}
                employees={employees}
                onChange={setParticipants}
              />
            </div>

            {/* Section 5: Status and Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status & Notes</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                {isSubmitting ? "Saving..." : isEditing ? "Update Deal" : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
