import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Shield, Lock } from "lucide-react";
import { useRoles, type RoleDefinition } from "@/hooks/useRoles";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  { value: "red", label: "Red", class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { value: "blue", label: "Blue", class: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "green", label: "Green", class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "purple", label: "Purple", class: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "orange", label: "Orange", class: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "slate", label: "Slate", class: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300" },
  { value: "pink", label: "Pink", class: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { value: "teal", label: "Teal", class: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
];

function getColorClass(color: string | null) {
  return COLOR_OPTIONS.find(c => c.value === color)?.class || COLOR_OPTIONS[5].class;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function RoleBuilder() {
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("slate");

  // Fetch user counts per role
  const { data: roleCounts } = useQuery({
    queryKey: ["role-user-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        counts[r.role] = (counts[r.role] || 0) + 1;
      });
      return counts;
    },
  });

  const openCreate = () => {
    setEditingRole(null);
    setFormLabel("");
    setFormName("");
    setFormDescription("");
    setFormColor("slate");
    setIsFormOpen(true);
  };

  const openEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setFormLabel(role.label);
    setFormName(role.name);
    setFormDescription(role.description || "");
    setFormColor(role.color || "slate");
    setIsFormOpen(true);
  };

  const handleLabelChange = (value: string) => {
    setFormLabel(value);
    if (!editingRole) {
      setFormName(slugify(value));
    }
  };

  const handleSubmit = () => {
    if (!formLabel.trim() || !formName.trim()) {
      toast.error("Label and name are required");
      return;
    }

    if (editingRole) {
      updateRole.mutate({
        id: editingRole.id,
        label: formLabel,
        description: formDescription || undefined,
        color: formColor,
      });
    } else {
      createRole.mutate({
        name: formName,
        label: formLabel,
        description: formDescription || undefined,
        color: formColor,
      });
    }
    setIsFormOpen(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteRole.mutate(deleteTarget.name);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Role Builder</CardTitle>
              <CardDescription>
                Create and manage roles. New roles automatically appear in the Permissions Matrix.
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Machine Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Badge className={getColorClass(role.color)}>{role.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {role.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {roleCounts?.[role.name] || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {role.is_system_role ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          System
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={role.is_system_role}
                          onClick={() => setDeleteTarget(role)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role details. The machine name cannot be changed."
                : "New roles start with all permissions disabled. Configure them in the Permissions Matrix."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={formLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Regional Manager"
              />
            </div>

            <div className="space-y-2">
              <Label>Machine Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(slugify(e.target.value))}
                placeholder="e.g. regional_manager"
                disabled={!!editingRole}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Used internally. Lowercase, underscores only.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this role's purpose"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormColor(opt.value)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all",
                      opt.class,
                      formColor === opt.value
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createRole.isPending || updateRole.isPending}
            >
              {(createRole.isPending || updateRole.isPending) && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role "{deleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the role from all assigned users ({roleCounts?.[deleteTarget?.name || ""] || 0} users)
              and delete all associated permissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
