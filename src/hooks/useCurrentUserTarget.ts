import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserTarget } from "./useUserTargets";

export function useCurrentUserTarget() {
  return useQuery({
    queryKey: ["current_user_target"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("user_targets")
        .select(`
          *,
          comp_plans:plan_id (
            id,
            name,
            description,
            is_active
          )
        `)
        .eq("user_id", user.id)
        .lte("effective_start_date", today)
        .gte("effective_end_date", today)
        .order("effective_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as (UserTarget & { comp_plans: { id: string; name: string; description: string | null; is_active: boolean } }) | null;
    },
  });
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ["current_user_profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
