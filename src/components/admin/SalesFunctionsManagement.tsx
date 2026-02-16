import { useState } from "react";
import { useSalesFunctions } from "@/hooks/useSalesFunctions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export function SalesFunctionsManagement() {
  const {
    salesFunctions,
    isLoading,
    addSalesFunction,
    updateSalesFunction,
    toggleActive,
    deleteSalesFunction,
    reorder,
  } = useSalesFunctions(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await addSalesFunction(nameInput.trim());
      setNameInput("");
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editId || !nameInput.trim()) return;
    setSaving(true);
    try {
      await updateSalesFunction({ id: editId, name: nameInput.trim() });
      setEditId(null);
      setNameInput("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Check if any employees use this function
    const fn = salesFunctions.find((f) => f.id === deleteId);
    if (fn) {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("sales_function", fn.name);
      if (count && count > 0) {
        toast.error(`Cannot delete: ${count} employee(s) are using this function`);
        setDeleteId(null);
        return;
      }
    }
    await deleteSalesFunction(deleteId);
    setDeleteId(null);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const ids = salesFunctions.map((f) => f.id);
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[index], ids[swapIdx]] = [ids[swapIdx], ids[index]];
    await reorder(ids);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sales Functions</h2>
          <p className="text-sm text-muted-foreground">
            Manage the sales function list used across the system
          </p>
        </div>
        <Button onClick={() => { setNameInput(""); setAddOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Function
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesFunctions.map((fn, idx) => (
              <TableRow key={fn.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{fn.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={fn.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleActive({ id: fn.id, is_active: !fn.is_active })}
                  >
                    {fn.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === salesFunctions.length - 1}
                      onClick={() => handleMove(idx, "down")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditId(fn.id);
                        setNameInput(fn.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(fn.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {salesFunctions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No sales functions configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sales Function</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. Account Manager"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !nameInput.trim()}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Sales Function</DialogTitle>
          </DialogHeader>
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEdit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !nameInput.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Function?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this function. It can only be deleted if no employees are currently assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
