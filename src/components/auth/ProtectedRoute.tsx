import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { PermissionKey } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  /** @deprecated Use permissionKey instead for dynamic permissions */
  allowedRoles?: AppRole[];
  /** Dynamic permission key - preferred over allowedRoles */
  permissionKey?: PermissionKey;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles, 
  permissionKey,
  redirectTo = "/dashboard" 
}: ProtectedRouteProps) {
  const { roles, isLoading: rolesLoading, isAuthenticated } = useUserRole();
  const { canAccessPage, isLoading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  // Wait for both roles and permissions to load to prevent UI flicker
  const isLoading = rolesLoading || permissionsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in, send to auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check access using permission key (preferred) or legacy roles
  const hasAccess = permissionKey 
    ? canAccessPage(permissionKey)
    : allowedRoles?.some((role) => roles.includes(role)) ?? false;

  if (!hasAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate(redirectTo)}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
