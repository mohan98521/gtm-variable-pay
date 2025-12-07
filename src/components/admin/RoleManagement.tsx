import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Search, Loader2, UserCog, Plus, X } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
}

const ALL_ROLES: { role: AppRole; label: string; description: string; color: string }[] = [
  { role: "admin", label: "Admin", description: "Full system access", color: "bg-destructive/10 text-destructive" },
  { role: "gtm_ops", label: "GTM Ops", description: "Data inputs & operations", color: "bg-primary/10 text-primary" },
  { role: "finance", label: "Finance", description: "View compensation data", color: "bg-success/10 text-success" },
  { role: "executive", label: "Executive", description: "View-only dashboards", color: "bg-accent/10 text-accent" },
  { role: "sales_head", label: "Sales Head", description: "Team management", color: "bg-warning/10 text-warning" },
  { role: "sales_rep", label: "Sales Rep", description: "Personal dashboard", color: "bg-muted text-muted-foreground" },
];

export function RoleManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name');
      
      if (profilesError) throw profilesError;

      // Get all roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: (allRoles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role as AppRole)
      }));

      return usersWithRoles;
    }
  });

  // Update user roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async ({ userId, newRoles }: { userId: string; newRoles: AppRole[] }) => {
      // Delete existing roles for user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      // Insert new roles
      if (newRoles.length > 0) {
        const rolesToInsert = newRoles.map(role => ({
          user_id: userId,
          role: role
        }));

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToInsert);
        
        if (insertError) throw insertError;
      }

      return { userId, newRoles };
    },
    onSuccess: (data) => {
      toast.success('Roles updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to update roles', { description: error.message });
    }
  });

  const handleEditRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setIsDialogOpen(true);
  };

  const handleSaveRoles = () => {
    if (selectedUser) {
      updateRolesMutation.mutate({ userId: selectedUser.id, newRoles: selectedRoles });
    }
  };

  const toggleRole = (role: AppRole) => {
    // Single-role selection: selecting a role unchecks all others
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? [] // Allow unchecking to have no role
        : [role] // Only allow one role at a time
    );
  };

  // Filter users based on search
  const filteredUsers = users?.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.roles.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleBadgeStyle = (role: AppRole) => {
    const roleInfo = ALL_ROLES.find(r => r.role === role);
    return roleInfo?.color || "bg-muted text-muted-foreground";
  };

  // Stats
  const totalUsers = users?.length || 0;
  const usersWithRoles = users?.filter(u => u.roles.length > 0).length || 0;
  const adminCount = users?.filter(u => u.roles.includes('admin')).length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-semibold text-foreground">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Users with Roles</p>
                <p className="text-2xl font-semibold text-foreground">{usersWithRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administrators</p>
                <p className="text-2xl font-semibold text-foreground">{adminCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Role Management</CardTitle>
              <CardDescription>Assign and manage user roles for access control</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map(role => (
                              <Badge key={role} className={getRoleBadgeStyle(role)}>
                                {ALL_ROLES.find(r => r.role === role)?.label || role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No roles assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditRoles(user)}
                        >
                          <UserCog className="h-3 w-3 mr-1.5" />
                          Manage Roles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No users found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Role Legend */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Role Descriptions</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_ROLES.map(roleInfo => (
                <div key={roleInfo.role} className="flex items-center gap-2">
                  <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
                  <span className="text-sm text-muted-foreground">{roleInfo.description}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Roles Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles for {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>
              Select the roles to assign to this user. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {ALL_ROLES.map(roleInfo => (
              <div 
                key={roleInfo.role} 
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleRole(roleInfo.role)}
              >
                <Checkbox 
                  checked={selectedRoles.includes(roleInfo.role)}
                  onCheckedChange={() => toggleRole(roleInfo.role)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{roleInfo.label}</span>
                    <Badge variant="outline" className="text-xs">{roleInfo.role}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{roleInfo.description}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRoles}
              disabled={updateRolesMutation.isPending}
            >
              {updateRolesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Roles'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
