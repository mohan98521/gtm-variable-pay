import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SupportTeam {
  id: string;
  team_name: string;
  team_role: string;
  region: string | null;
  bu: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SupportTeamMember {
  id: string;
  team_id: string;
  employee_id: string;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface SupportTeamWithMembers extends SupportTeam {
  members: SupportTeamMember[];
}

const TEAM_ROLES = [
  { value: "sales_engineering", label: "Sales Engineering" },
  { value: "sales_engineering_head", label: "Sales Engineering Head" },
  { value: "product_specialist", label: "Product Specialist" },
  { value: "product_specialist_head", label: "Product Specialist Head" },
  { value: "solution_manager", label: "Solution Manager" },
  { value: "solution_manager_head", label: "Solution Manager Head" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "sales_head", label: "Sales Head" },
] as const;

export { TEAM_ROLES };

export function useSupportTeams() {
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["support-teams"],
    queryFn: async () => {
      const { data: teams, error: teamsError } = await supabase
        .from("support_teams" as any)
        .select("*")
        .order("team_name");

      if (teamsError) throw teamsError;

      const { data: members, error: membersError } = await supabase
        .from("support_team_members" as any)
        .select("*");

      if (membersError) throw membersError;

      return (teams as any[]).map((team: any) => ({
        ...team,
        members: (members as any[]).filter((m: any) => m.team_id === team.id),
      })) as SupportTeamWithMembers[];
    },
  });

  const createTeam = useMutation({
    mutationFn: async (team: { team_name: string; team_role: string; region?: string; bu?: string }) => {
      const { data, error } = await supabase
        .from("support_teams" as any)
        .insert(team as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Support team created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTeam> & { id: string }) => {
      const { error } = await supabase
        .from("support_teams" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Support team updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_teams" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Support team deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMember = useMutation({
    mutationFn: async (member: { team_id: string; employee_id: string; effective_from: string; effective_to?: string }) => {
      const { error } = await supabase
        .from("support_team_members" as any)
        .insert(member as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Member added to team");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("support_team_members" as any)
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Member removed from team");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTeamMember> & { id: string }) => {
      const { error } = await supabase
        .from("support_team_members" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-teams"] });
      toast.success("Member updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    teams: teamsQuery.data || [],
    isLoading: teamsQuery.isLoading,
    error: teamsQuery.error,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    updateMember,
  };
}

/**
 * Resolve support team members for a given team_id and deal month.
 * Returns employee_ids of active members whose effective dates cover the deal month.
 */
export async function resolveTeamMembers(teamId: string, dealMonth: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("support_team_members" as any)
    .select("employee_id")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .lte("effective_from", dealMonth)
    .or(`effective_to.is.null,effective_to.gte.${dealMonth}`);

  if (error) throw error;
  return (data as any[]).map((m: any) => m.employee_id);
}
