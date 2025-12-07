import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  employee_id: string | null;
  designation: string | null;
  country: string | null;
  city: string | null;
  date_of_hire: string | null;
  group_name: string | null;
  business_unit: string | null;
  function_area: string | null;
  sales_function: string | null;
  local_currency: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!userId,
  });
}
