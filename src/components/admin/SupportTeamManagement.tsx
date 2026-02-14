import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users, UserPlus, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useSupportTeams, TEAM_ROLES, SupportTeamWithMembers } from "@/hooks/useSupportTeams";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function SupportTeamManagement() {
  const { teams, isLoading, createTeam, updateTeam, deleteTeam, addMember, removeMember } = useSupportTeams();
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New team form state
  const [newTeam, setNewTeam] = useState({ team_name: "", team_role: "", region: "", bu: "" });
  // New member form state
  const [newMember, setNewMember] = useState({ employee_id: "", effective_from: format(new Date(), "yyyy-MM-dd"), effective_to: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredTeams = teams.filter((t) => {
    const matchesRole = filterRole === "all" || t.team_role === filterRole;
    const matchesSearch = !searchQuery || t.team_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const getEmployeeName = (empId: string) => {
    return employees.find((e) => e.employee_id === empId)?.full_name || empId;
  };

  const getRoleLabel = (role: string) => {
    return TEAM_ROLES.find((r) => r.value === role)?.label || role;
  };

  const handleCreateTeam = async () => {
    if (!newTeam.team_name || !newTeam.team_role) return;
    await createTeam.mutateAsync({
      team_name: newTeam.team_name,
      team_role: newTeam.team_role,
      region: newTeam.region || undefined,
      bu: newTeam.bu || undefined,
    });
    setNewTeam({ team_name: "", team_role: "", region: "", bu: "" });
    setShowCreateDialog(false);
  };

  const handleAddMember = async () => {
    if (!showAddMemberDialog || !newMember.employee_id || !newMember.effective_from) return;
    await addMember.mutateAsync({
      team_id: showAddMemberDialog,
      employee_id: newMember.employee_id,
      effective_from: newMember.effective_from,
      effective_to: newMember.effective_to || undefined,
    });
    setNewMember({ employee_id: "", effective_from: format(new Date(), "yyyy-MM-dd"), effective_to: "" });
    setShowAddMemberDialog(null);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading support teams...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Support Teams</h2>
          <p className="text-sm text-muted-foreground">
            Define teams of employees who collectively support regions/BUs. All team members receive 100% credit for deals.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Team
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {TEAM_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Teams List */}
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No support teams found</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first team to enable team-based deal attribution.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isExpanded={expandedTeamId === team.id}
              onToggle={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
              onAddMember={() => setShowAddMemberDialog(team.id)}
              onRemoveMember={(memberId) => removeMember.mutate(memberId)}
              onToggleActive={() => updateTeam.mutate({ id: team.id, is_active: !team.is_active })}
              onDelete={() => {
                if (confirm(`Delete team "${team.team_name}"? This will remove all members.`))
                  deleteTeam.mutate(team.id);
              }}
              getEmployeeName={getEmployeeName}
              getRoleLabel={getRoleLabel}
            />
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input
                value={newTeam.team_name}
                onChange={(e) => setNewTeam({ ...newTeam, team_name: e.target.value })}
                placeholder="e.g., APAC SE Team"
              />
            </div>
            <div>
              <Label>Team Role</Label>
              <Select value={newTeam.team_role} onValueChange={(v) => setNewTeam({ ...newTeam, team_role: v })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region (optional)</Label>
                <Input
                  value={newTeam.region}
                  onChange={(e) => setNewTeam({ ...newTeam, region: e.target.value })}
                  placeholder="e.g., APAC"
                />
              </div>
              <div>
                <Label>Business Unit (optional)</Label>
                <Input
                  value={newTeam.bu}
                  onChange={(e) => setNewTeam({ ...newTeam, bu: e.target.value })}
                  placeholder="e.g., Banking"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeam.team_name || !newTeam.team_role || createTeam.isPending}>
              {createTeam.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!showAddMemberDialog} onOpenChange={() => setShowAddMemberDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <SearchableSelect
                value={newMember.employee_id || "_none"}
                onValueChange={(v) => setNewMember({ ...newMember, employee_id: v === "_none" ? "" : v })}
                options={[
                  { value: "_none", label: "Select employee" },
                  ...employees.map((e) => ({
                    value: e.employee_id,
                    label: `${e.full_name} (${e.employee_id})`,
                  })),
                ]}
                placeholder="Search employees..."
                searchPlaceholder="Search..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={newMember.effective_from}
                  onChange={(e) => setNewMember({ ...newMember, effective_from: e.target.value })}
                />
              </div>
              <div>
                <Label>Effective To (optional)</Label>
                <Input
                  type="date"
                  value={newMember.effective_to}
                  onChange={(e) => setNewMember({ ...newMember, effective_to: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(null)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!newMember.employee_id || addMember.isPending}>
              {addMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for each team card
function TeamCard({
  team,
  isExpanded,
  onToggle,
  onAddMember,
  onRemoveMember,
  onToggleActive,
  onDelete,
  getEmployeeName,
  getRoleLabel,
}: {
  team: SupportTeamWithMembers;
  isExpanded: boolean;
  onToggle: () => void;
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  getEmployeeName: (id: string) => string;
  getRoleLabel: (role: string) => string;
}) {
  const activeMembers = team.members.filter((m) => m.is_active);

  return (
    <Card>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <CardTitle className="text-sm font-medium">{team.team_name}</CardTitle>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{getRoleLabel(team.team_role)}</Badge>
                {team.region && <Badge variant="outline" className="text-xs">{team.region}</Badge>}
                {team.bu && <Badge variant="outline" className="text-xs">{team.bu}</Badge>}
                <Badge variant={team.is_active ? "default" : "destructive"} className="text-xs">
                  {team.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">{activeMembers.length} member(s)</span>
            <Button size="sm" variant="outline" onClick={onToggleActive}>
              {team.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="outline" onClick={onAddMember}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member
            </Button>
          </div>
          {team.members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members yet. Add employees to this team.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{getEmployeeName(member.employee_id)}</TableCell>
                    <TableCell>{member.effective_from}</TableCell>
                    <TableCell>{member.effective_to || "Ongoing"}</TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? "default" : "secondary"} className="text-xs">
                        {member.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => onRemoveMember(member.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
