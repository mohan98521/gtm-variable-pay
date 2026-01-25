import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import type { PermissionKey } from "@/lib/permissions";

interface RolePermission {
  role: AppRole;
  permission_key: string;
  is_allowed: boolean;
}

export function usePermissions() {
  const { roles, isLoading: rolesLoading, isAuthenticated } = useUserRole();

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission_key, is_allowed");
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoading = rolesLoading || permissionsLoading;

  /**
   * Check if current user has a specific permission
   * Returns true if ANY of their roles has this permission enabled
   */
  const hasPermission = (permissionKey: PermissionKey): boolean => {
    if (!permissions || roles.length === 0) return false;
    
    return roles.some(role => {
      const permission = permissions.find(
        p => p.role === role && p.permission_key === permissionKey
      );
      return permission?.is_allowed === true;
    });
  };

  /**
   * Check if current user can access a page
   */
  const canAccessPage = (pageKey: PermissionKey): boolean => {
    return hasPermission(pageKey);
  };

  /**
   * Check if current user can perform an action
   */
  const canPerformAction = (actionKey: PermissionKey): boolean => {
    return hasPermission(actionKey);
  };

  /**
   * Check if current user can access an admin tab
   */
  const canAccessTab = (tabKey: PermissionKey): boolean => {
    return hasPermission(tabKey);
  };

  /**
   * Get all permissions for all roles (for admin management UI)
   */
  const getAllPermissions = () => permissions || [];

  /**
   * Check permission for a specific role (for admin management UI)
   */
  const getRolePermission = (role: AppRole, permissionKey: PermissionKey): boolean => {
    if (!permissions) return false;
    const permission = permissions.find(
      p => p.role === role && p.permission_key === permissionKey
    );
    return permission?.is_allowed === true;
  };

  return {
    isLoading,
    hasPermission,
    canAccessPage,
    canPerformAction,
    canAccessTab,
    getAllPermissions,
    getRolePermission,
  };
}
