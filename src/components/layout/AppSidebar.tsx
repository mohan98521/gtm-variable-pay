import { LayoutDashboard, Users, Settings, FileSpreadsheet, LogOut, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AzentioLogo } from "@/components/AzentioLogo";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/lib/permissions";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionKey: PermissionKey;
}

const navigation: NavItem[] = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard,
    permissionKey: "page:dashboard"
  },
  { 
    name: "Team View", 
    href: "/team", 
    icon: Users,
    permissionKey: "page:team_view"
  },
  { 
    name: "Plan Config", 
    href: "/admin", 
    icon: Settings,
    permissionKey: "page:plan_config"
  },
  { 
    name: "Reports", 
    href: "/reports", 
    icon: BarChart3,
    permissionKey: "page:reports"
  },
  { 
    name: "Data Inputs", 
    href: "/data-inputs", 
    icon: FileSpreadsheet,
    permissionKey: "page:data_inputs"
  },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessPage, isLoading } = usePermissions();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      navigate("/auth");
    }
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  // Filter navigation items based on dynamic permissions from database
  const filteredNavigation = navigation.filter(item => 
    canAccessPage(item.permissionKey)
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border shadow-lg">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border bg-sidebar/95">
        <AzentioLogo variant="light" size="sm" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={`nav-item ${isActive ? "active bg-sidebar-accent" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-sidebar-primary" : ""}`} />
              <span className={isActive ? "text-sidebar-foreground font-semibold" : ""}>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User info section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 text-xs text-sidebar-muted uppercase tracking-wider">
          GTM Variable Compensation
        </div>
        <button
          onClick={handleSignOut}
          className="nav-item w-full text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
