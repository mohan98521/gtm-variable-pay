import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = string;

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        setRoles([]);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
      } else {
        setRoles((data || []).map((r) => r.role as AppRole));
      }
      setIsLoading(false);
    };

    fetchRoles();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return;
      setIsLoading(true);
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole("admin");
  const isSalesHead = () => hasRole("sales_head");
  const isSalesRep = () => hasRole("sales_rep");
  const isGtmOps = () => hasRole("gtm_ops");
  const isFinance = () => hasRole("finance");
  const isExecutive = () => hasRole("executive");

  // Check if user has any management/viewing role for broader access
  const canViewAllData = () => isAdmin() || isGtmOps() || isFinance() || isExecutive();
  const canManageData = () => isAdmin() || isGtmOps();

  return {
    roles,
    isLoading,
    isAuthenticated,
    hasRole,
    isAdmin,
    isSalesHead,
    isSalesRep,
    isGtmOps,
    isFinance,
    isExecutive,
    canViewAllData,
    canManageData,
  };
}
