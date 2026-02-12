import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, FileSpreadsheet, BarChart3, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/lib/permissions";

interface QuickLink {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  permissionKey: PermissionKey;
}

const quickLinks: QuickLink[] = [
  {
    name: "Plan Config",
    href: "/admin",
    icon: Settings,
    description: "Manage compensation plans, employees, and system settings",
    permissionKey: "page:plan_config",
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "View employee master data, incentive audits, and payout statements",
    permissionKey: "page:reports",
  },
  {
    name: "Data Inputs",
    href: "/data-inputs",
    icon: FileSpreadsheet,
    description: "Manage deals, collections, closing ARR, and exchange rates",
    permissionKey: "page:data_inputs",
  },
  {
    name: "Team View",
    href: "/team",
    icon: Users,
    description: "Review team performance and direct report compensation",
    permissionKey: "page:team_view",
  },
];

interface StaffLandingPageProps {
  userName?: string;
}

export function StaffLandingPage({ userName }: StaffLandingPageProps) {
  const navigate = useNavigate();
  const { roles } = useUserRole();
  const { canAccessPage } = usePermissions();

  const accessibleLinks = quickLinks.filter((link) => canAccessPage(link.permissionKey));

  const roleLabel = roles.length > 0
    ? roles.map((r) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).join(", ")
    : "Staff";

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <LayoutDashboard className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome{userName ? `, ${userName}` : ""}
        </h1>
        <Badge variant="secondary" className="text-sm">
          {roleLabel}
        </Badge>
      </div>

      {accessibleLinks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 w-full">
          {accessibleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card
                key={link.href}
                className="border-border/50 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
                onClick={() => navigate(link.href)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{link.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {link.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        You are not assigned to a compensation plan. This is expected for staff roles.
      </p>
    </div>
  );
}
