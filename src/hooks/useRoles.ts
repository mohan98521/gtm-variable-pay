import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RoleDefinition {
  id: string;
  name: string;
  label: string;
  description: string | null;
  color: string | null;
  is_system_role: boolean;
  created_at: string;
}

export function useRoles() {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("is_system_role", { ascending: false })
        .order("name");

      if (error) throw error;
      return data as RoleDefinition[];
    },
  });

  const createRole = useMutation({
    mutationFn: async (role: { name: string; label: string; description?: string; color?: string }) => {
      const { data, error } = await supabase
        .from("roles")
        .insert({
          name: role.name,
          label: role.label,
          description: role.description || null,
          color: role.color || "gray",
          is_system_role: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions-admin"] });
      toast.success("Role created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create role", { description: error.message });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; label?: string; description?: string; color?: string }) => {
      const { error } = await supabase
        .from("roles")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update role", { description: error.message });
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("roles")
        .delete()
        .eq("name", name)
        .eq("is_system_role", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions-admin"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete role", { description: error.message });
    },
  });

  // Helper to get roles as {role, label} array for backward compatibility
  const allRoles = roles.map((r) => ({ role: r.name, label: r.label }));

  return {
    roles,
    allRoles,
    isLoading,
    createRole,
    updateRole,
    deleteRole,
  };
}
