import type { AppRole } from "@/hooks/useUserRole";

export type PermissionKey = 
  // Page Access
  | "page:dashboard"
  | "page:team_view"
  | "page:plan_config"
  | "page:reports"
  | "page:data_inputs"
  // Admin Tabs
  | "tab:employee_accounts"
  | "tab:bulk_upload"
  | "tab:role_management"
  | "tab:permissions"
  | "tab:comp_plans"
  | "tab:performance_targets"
  | "tab:payout_runs"
  | "tab:exchange_rates"
  // Actions
  | "action:create_comp_plan"
  | "action:edit_comp_plan"
  | "action:delete_comp_plan"
  | "action:create_employee"
  | "action:edit_employee"
  | "action:deactivate_employee"
  | "action:create_auth_account"
  | "action:manage_roles"
  | "action:upload_data"
  | "action:edit_actuals"
  | "action:edit_exchange_rates"
  | "action:export_reports";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: "page" | "tab" | "action";
  isLocked?: boolean; // Cannot be disabled for admin
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Page Access
  { key: "page:dashboard", label: "Dashboard", description: "Access to personal dashboard", category: "page" },
  { key: "page:team_view", label: "Team View", description: "View team members' performance", category: "page" },
  { key: "page:plan_config", label: "Plan Config", description: "Access to plan configuration (Admin page)", category: "page" },
  { key: "page:reports", label: "Reports", description: "Access to reports and analytics", category: "page" },
  { key: "page:data_inputs", label: "Data Inputs", description: "Manage actuals and exchange rates", category: "page" },
  
  // Admin Tabs
  { key: "tab:comp_plans", label: "Compensation Plans", description: "View compensation plans tab", category: "tab" },
  { key: "tab:employee_accounts", label: "Employee Accounts", description: "Manage employee accounts", category: "tab" },
  { key: "tab:bulk_upload", label: "Bulk Upload", description: "Upload employee data in bulk", category: "tab" },
  { key: "tab:performance_targets", label: "Performance Targets", description: "Manage employee performance targets", category: "tab" },
  { key: "tab:role_management", label: "Role Management", description: "Assign roles to users", category: "tab" },
  { key: "tab:permissions", label: "Permissions", description: "Configure role permissions", category: "tab", isLocked: true },
  { key: "tab:payout_runs", label: "Payout Runs", description: "Manage payout run lifecycle", category: "tab" },
  { key: "tab:exchange_rates", label: "Exchange Rates", description: "Manage exchange rates", category: "tab" },
  
  // Actions
  { key: "action:create_comp_plan", label: "Create Comp Plan", description: "Create new compensation plans", category: "action" },
  { key: "action:edit_comp_plan", label: "Edit Comp Plan", description: "Modify existing plans", category: "action" },
  { key: "action:delete_comp_plan", label: "Delete Comp Plan", description: "Remove compensation plans", category: "action" },
  { key: "action:create_employee", label: "Create Employee", description: "Add new employees", category: "action" },
  { key: "action:edit_employee", label: "Edit Employee", description: "Modify employee details", category: "action" },
  { key: "action:deactivate_employee", label: "Deactivate Employee", description: "Deactivate/reactivate employees", category: "action" },
  { key: "action:create_auth_account", label: "Create Auth Account", description: "Create login accounts", category: "action" },
  { key: "action:manage_roles", label: "Manage Roles", description: "Assign/modify user roles", category: "action" },
  { key: "action:upload_data", label: "Upload Data", description: "Bulk upload employee data", category: "action" },
  { key: "action:edit_actuals", label: "Edit Actuals", description: "Modify monthly actuals", category: "action" },
  { key: "action:edit_exchange_rates", label: "Edit Exchange Rates", description: "Modify exchange rates", category: "action" },
  { key: "action:export_reports", label: "Export Reports", description: "Download report data", category: "action" },
];

export const ALL_ROLES: { role: AppRole; label: string }[] = [
  { role: "admin", label: "Admin" },
  { role: "gtm_ops", label: "GTM Ops" },
  { role: "finance", label: "Finance" },
  { role: "executive", label: "Executive" },
  { role: "sales_head", label: "Sales Head" },
  { role: "sales_rep", label: "Sales Rep" },
];

export const CATEGORY_LABELS: Record<PermissionDefinition["category"], string> = {
  page: "Page Access",
  tab: "Admin Tabs",
  action: "Actions",
};

// Map page routes to permission keys
export const PAGE_PERMISSION_MAP: Record<string, PermissionKey> = {
  "/dashboard": "page:dashboard",
  "/team": "page:team_view",
  "/admin": "page:plan_config",
  "/reports": "page:reports",
  "/data-inputs": "page:data_inputs",
};
