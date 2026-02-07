import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Layers, Users, UserCog, Shield, Upload, Target, DollarSign, Calculator, Lock, Settings, type LucideIcon } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { CompensationPlansTab } from "@/components/admin/CompensationPlansTab";
import { EmployeeAccounts } from "@/components/admin/EmployeeAccounts";
import { RoleManagement } from "@/components/admin/RoleManagement";
import { BulkUpload } from "@/components/admin/BulkUpload";
import { PermissionsManagement } from "@/components/admin/PermissionsManagement";
import { PerformanceTargetsManagement } from "@/components/admin/PerformanceTargetsManagement";
import { ExchangeRateManagement } from "@/components/admin/ExchangeRateManagement";
import { PayoutRunManagement } from "@/components/admin/PayoutRunManagement";

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
      { id: "bulk-upload", label: "Bulk Upload", icon: Upload, permissionCheck: (c) => c.canAccessTab("tab:bulk_upload") },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    items: [
      { id: "exchange-rates", label: "Exchange Rates", icon: DollarSign, permissionCheck: (c) => c.isAdmin() || c.canAccessTab("tab:bulk_upload") },
      { id: "payout-runs", label: "Payout Runs", icon: Calculator, permissionCheck: (c) => c.isAdmin() || c.canAccessTab("tab:bulk_upload") },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
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
  "bulk-upload": BulkUpload,
  "exchange-rates": ExchangeRateManagement,
  "payout-runs": PayoutRunManagement,
  "permissions": PermissionsManagement,
};

export default function Admin() {
  const { isAdmin } = useUserRole();
  const { canAccessTab } = usePermissions();

  const permCtx: PermCtx = useMemo(() => ({ isAdmin, canAccessTab }), [isAdmin, canAccessTab]);

  // Compute visible sections (filter out items & sections with no visible items)
  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.permissionCheck(permCtx)),
      }))
      .filter((section) => section.items.length > 0);
  }, [permCtx]);

  // Default to first visible item
  const defaultItem = visibleSections[0]?.items[0]?.id || "plans";
  const [activeItem, setActiveItem] = useState(defaultItem);

  // Ensure activeItem is always valid
  const allVisibleIds = useMemo(
    () => visibleSections.flatMap((s) => s.items.map((i) => i.id)),
    [visibleSections]
  );
  const resolvedActiveItem = allVisibleIds.includes(activeItem) ? activeItem : defaultItem;

  const ContentComponent = contentMap[resolvedActiveItem];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Administration</h1>
          <p className="text-muted-foreground">Manage compensation plans and employee accounts</p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Section Nav — vertical on desktop, horizontal scroll on mobile */}
          <Card className="p-2 h-fit lg:sticky lg:top-6">
            {/* Desktop: vertical list */}
            <nav className="hidden lg:block space-y-4">
              {visibleSections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    <section.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {section.label}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveItem(item.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            resolvedActiveItem === item.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            {/* Mobile: horizontal scrollable pills */}
            <div className="flex lg:hidden gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {visibleSections.flatMap((section) =>
                section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveItem(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
                      resolvedActiveItem === item.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Content Area */}
          <div className="min-w-0">
            {ContentComponent && <ContentComponent />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
