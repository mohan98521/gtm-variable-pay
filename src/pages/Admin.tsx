import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
// Card import removed — no longer needed
import { cn } from "@/lib/utils";
import { Layers, Users, UserCog, Shield, Target, DollarSign, Calculator, Lock, Settings, UserPlus, Gift, UsersRound, UserMinus, Briefcase, type LucideIcon } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { CompensationPlansTab } from "@/components/admin/CompensationPlansTab";
import { EmployeeAccounts } from "@/components/admin/EmployeeAccounts";
import { RoleManagement } from "@/components/admin/RoleManagement";

import { PermissionsManagement } from "@/components/admin/PermissionsManagement";
import { PerformanceTargetsManagement } from "@/components/admin/PerformanceTargetsManagement";
import { ExchangeRateManagement } from "@/components/admin/ExchangeRateManagement";
import { PayoutRunManagement } from "@/components/admin/PayoutRunManagement";
import { RoleBuilder } from "@/components/admin/RoleBuilder";
import { DealTeamSpiffManager } from "@/components/admin/DealTeamSpiffManager";
import { SupportTeamManagement } from "@/components/admin/SupportTeamManagement";
import { FnFSettlementManagement } from "@/components/admin/FnFSettlementManagement";
import { SalesFunctionsManagement } from "@/components/admin/SalesFunctionsManagement";

// --- Section / Item types ---
interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  permissionCheck: (ctx: PermCtx) => boolean;
}

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface PermCtx {
  isAdmin: () => boolean;
  canAccessTab: (key: string) => boolean;
}

// --- Section definitions ---
const sections: NavSection[] = [
  {
    id: "compensation",
    label: "Compensation",
    icon: Layers,
    items: [
      { id: "plans", label: "Compensation Plans", icon: Layers, permissionCheck: (c) => c.canAccessTab("tab:comp_plans") },
      { id: "performance-targets", label: "Performance Targets", icon: Target, permissionCheck: (c) => c.canAccessTab("tab:performance_targets") },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    items: [
      { id: "accounts", label: "Employee Accounts", icon: UserCog, permissionCheck: (c) => c.canAccessTab("tab:employee_accounts") },
      { id: "roles", label: "Role Management", icon: Shield, permissionCheck: (c) => c.canAccessTab("tab:role_management") },
      { id: "support-teams", label: "Support Teams", icon: UsersRound, permissionCheck: (c) => c.canAccessTab("tab:support_teams") },
      { id: "sales-functions", label: "Sales Functions", icon: Briefcase, permissionCheck: (c) => c.canAccessTab("tab:sales_functions") },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    items: [
      { id: "exchange-rates", label: "Exchange Rates", icon: DollarSign, permissionCheck: (c) => c.canAccessTab("tab:exchange_rates") },
      { id: "payout-runs", label: "Payout Runs", icon: Calculator, permissionCheck: (c) => c.canAccessTab("tab:payout_runs") },
      { id: "fnf-settlements", label: "F&F Settlements", icon: UserMinus, permissionCheck: (c) => c.canAccessTab("tab:fnf_settlements") },
      { id: "deal-team-spiffs", label: "Deal Team SPIFFs", icon: Gift, permissionCheck: (c) => c.canAccessTab("tab:deal_team_spiffs") },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { id: "roles-builder", label: "Roles", icon: UserPlus, permissionCheck: (c) => c.canAccessTab("tab:roles") },
      { id: "permissions", label: "Permissions", icon: Lock, permissionCheck: (c) => c.isAdmin() },
    ],
  },
];

// --- Content renderer ---
const contentMap: Record<string, React.ComponentType> = {
  "plans": CompensationPlansTab,
  "performance-targets": PerformanceTargetsManagement,
  "accounts": EmployeeAccounts,
  "roles": RoleManagement,
  "support-teams": SupportTeamManagement,
  "fnf-settlements": FnFSettlementManagement,
  
  "exchange-rates": ExchangeRateManagement,
  "payout-runs": PayoutRunManagement,
  "deal-team-spiffs": DealTeamSpiffManager,
  "permissions": PermissionsManagement,
  "roles-builder": RoleBuilder,
  "sales-functions": SalesFunctionsManagement,
};

export default function Admin() {
  const { isAdmin } = useUserRole();
  const { canAccessTab } = usePermissions();

  const permCtx: PermCtx = useMemo(() => ({ isAdmin, canAccessTab }), [isAdmin, canAccessTab]);

  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.permissionCheck(permCtx)),
      }))
      .filter((section) => section.items.length > 0);
  }, [permCtx]);

  const defaultSectionId = visibleSections[0]?.id || "compensation";
  const [activeSection, setActiveSection] = useState(defaultSectionId);
  const [activeItem, setActiveItem] = useState(visibleSections[0]?.items[0]?.id || "plans");

  // Resolve active section & item
  const resolvedSection = visibleSections.find((s) => s.id === activeSection) || visibleSections[0];
  const allVisibleIds = useMemo(
    () => visibleSections.flatMap((s) => s.items.map((i) => i.id)),
    [visibleSections]
  );
  const resolvedActiveItem = allVisibleIds.includes(activeItem) ? activeItem : resolvedSection?.items[0]?.id || "plans";

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    const section = visibleSections.find((s) => s.id === sectionId);
    if (section?.items[0]) {
      setActiveItem(section.items[0].id);
    }
  };

  const ContentComponent = contentMap[resolvedActiveItem];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-0">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Administration</h1>
          <p className="text-muted-foreground">Manage compensation plans and employee accounts</p>
        </div>

        {/* Tier 1: Section tabs */}
        <div className="flex items-center gap-0 overflow-x-auto border-b border-border">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px",
                resolvedSection?.id === section.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Tier 2: Sub-item pills */}
        {resolvedSection && (
          <div className="flex items-center gap-2 overflow-x-auto py-3 border-b border-border">
            {resolvedSection.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors shrink-0",
                  resolvedActiveItem === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Area — full width */}
        <div className="pt-6">
          {ContentComponent && <ContentComponent />}
        </div>
      </div>
    </AppLayout>
  );
}
