import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  designation: string | null;
  sales_function: string | null;
  function_area: string | null;
  business_unit: string | null;
  group_name: string | null;
  manager_employee_id: string | null;
  city: string | null;
  country: string | null;
  local_currency: string;
  date_of_hire: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmployees(activeOnly = true) {
  return useQuery({
    queryKey: ["employees", activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("*")
        .order("full_name", { ascending: true });

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployeeById(employeeId: string) {
  return useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!employeeId,
  });
}
