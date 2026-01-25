import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, RotateCcw, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  PERMISSION_DEFINITIONS,
  ALL_ROLES,
  CATEGORY_LABELS,
  type PermissionKey,
} from "@/lib/permissions";
import type { AppRole } from "@/hooks/useUserRole";

interface RolePermission {
  id: string;
  role: AppRole;
  permission_key: string;
  is_allowed: boolean;
}

export function PermissionsManagement() {
  const queryClient = useQueryClient();
  const [localChanges, setLocalChanges] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all permissions
  const { data: permissions, isLoading } = useQuery({
    queryKey: ["role-permissions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id, role, permission_key, is_allowed");
      
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  // Build a lookup map for current permission state
  const getPermissionKey = (role: AppRole, permKey: PermissionKey) => `${role}:${permKey}`;
  
  const getCurrentValue = (role: AppRole, permKey: PermissionKey): boolean => {
    const key = getPermissionKey(role, permKey);
    if (key in localChanges) return localChanges[key];
    
    const perm = permissions?.find(p => p.role === role && p.permission_key === permKey);
    return perm?.is_allowed ?? false;
  };

  // Handle toggle
  const handleToggle = (role: AppRole, permKey: PermissionKey, checked: boolean) => {
    const key = getPermissionKey(role, permKey);
    setLocalChanges(prev => ({ ...prev, [key]: checked }));
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { role: AppRole; permission_key: string; is_allowed: boolean }[] = [];
      
      for (const [key, value] of Object.entries(localChanges)) {
        const [role, ...permParts] = key.split(":");
        const permKey = permParts.join(":");
        updates.push({
          role: role as AppRole,
          permission_key: permKey,
          is_allowed: value,
        });
      }

      // Batch upsert
      for (const update of updates) {
        const { error } = await supabase
          .from("role_permissions")
          .update({ is_allowed: update.is_allowed })
          .eq("role", update.role)
          .eq("permission_key", update.permission_key);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions-admin"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      setLocalChanges({});
      setHasChanges(false);
      toast.success("Permissions saved successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to save permissions", { description: error.message });
    },
  });

  // Reset to original values
  const handleReset = () => {
    setLocalChanges({});
    setHasChanges(false);
  };

  // Group permissions by category
  const permissionsByCategory = PERMISSION_DEFINITIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof PERMISSION_DEFINITIONS>);

  // Stats
  const totalPermissions = PERMISSION_DEFINITIONS.length * ALL_ROLES.length;
  const enabledCount = permissions?.filter(p => p.is_allowed).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Permissions</p>
                <p className="text-2xl font-semibold text-foreground">{PERMISSION_DEFINITIONS.length}</p>
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
                <p className="text-sm text-muted-foreground">Active Grants</p>
                <p className="text-2xl font-semibold text-foreground">{enabledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Roles Managed</p>
                <p className="text-2xl font-semibold text-foreground">{ALL_ROLES.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Permissions Matrix</CardTitle>
              <CardDescription>
                Configure what each role can access in the system
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges || saveMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-[200px]">
                    Permission
                  </th>
                  {ALL_ROLES.map(({ role, label }) => (
                    <th key={role} className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[80px]">
                      <span className="text-xs">{label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["page", "tab", "action"] as const).map((category) => (
                  <>
                    {/* Category Header */}
                    <tr key={`cat-${category}`} className="bg-muted/50">
                      <td colSpan={ALL_ROLES.length + 1} className="py-2 px-2 font-semibold text-foreground">
                        {CATEGORY_LABELS[category]}
                      </td>
                    </tr>
                    {/* Permissions in this category */}
                    {permissionsByCategory[category]?.map((perm) => (
                      <tr key={perm.key} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{perm.label}</span>
                            {perm.isLocked && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Lock className="h-3 w-3" />
                                Admin Only
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </td>
                        {ALL_ROLES.map(({ role }) => {
                          const isLocked = perm.isLocked && role === "admin";
                          const isDisabled = perm.isLocked && role !== "admin";
                          const value = getCurrentValue(role, perm.key);
                          
                          return (
                            <td key={`${role}-${perm.key}`} className="text-center py-3 px-2">
                              {isLocked ? (
                                <div className="flex items-center justify-center">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ) : (
                                <Switch
                                  checked={value}
                                  onCheckedChange={(checked) => handleToggle(role, perm.key, checked)}
                                  disabled={isDisabled}
                                  className="data-[state=checked]:bg-success"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Locked - Cannot be modified</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked disabled className="data-[state=checked]:bg-success scale-75" />
              <span>Enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch disabled className="scale-75" />
              <span>Disabled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
