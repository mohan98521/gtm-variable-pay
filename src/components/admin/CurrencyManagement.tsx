/**
 * Currency Management UI
 * 
 * Allows admins to add, edit, and delete supported currencies.
 * Integrated into the Exchange Rates admin tab.
 */

import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, Coins, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCurrencyManagement, type Currency } from "@/hooks/useCurrencies";
import { supabase } from "@/integrations/supabase/client";

export function CurrencyManagement() {
  const {
    allCurrencies,
    isLoading,
    createCurrency,
    updateCurrency,
    deleteCurrency,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCurrencyManagement();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deletingCurrency, setDeletingCurrency] = useState<Currency | null>(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({ code: "", name: "", symbol: "", is_active: true });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEdit = (currency: Currency) => {
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      is_active: currency.is_active,
    });
    setEditingCurrency(currency);
  };

  const handleSubmitAdd = () => {
    const code = formData.code.trim().toUpperCase();
    if (!code || !formData.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }
    if (code.length < 2 || code.length > 5) {
      toast.error("Currency code must be 2-5 characters");
      return;
    }
    createCurrency(
      { code, name: formData.name, symbol: formData.symbol.trim() || undefined },
      { onSuccess: () => { setShowAddDialog(false); resetForm(); } }
    );
  };

  const handleSubmitEdit = () => {
    if (!editingCurrency || !formData.name.trim() || !formData.symbol.trim()) {
      toast.error("Name and symbol are required");
      return;
    }
    updateCurrency(
      { id: editingCurrency.id, name: formData.name, symbol: formData.symbol, is_active: formData.is_active },
      { onSuccess: () => { setEditingCurrency(null); resetForm(); } }
    );
  };

  const handleDeleteCheck = async (currency: Currency) => {
    setDeleteCheckLoading(true);
    try {
      // Check if any employees use this currency
      const { count: empCount } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("local_currency", currency.code);

      // Check if any exchange rates exist for this currency
      const { count: rateCount } = await supabase
        .from("exchange_rates")
        .select("id", { count: "exact", head: true })
        .eq("currency_code", currency.code);

      if ((empCount || 0) > 0 || (rateCount || 0) > 0) {
        toast.error(
          `Cannot delete ${currency.code}: used by ${empCount || 0} employee(s) and ${rateCount || 0} exchange rate(s). Deactivate it instead.`
        );
        return;
      }

      setDeletingCurrency(currency);
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingCurrency) return;
    deleteCurrency(deletingCurrency.id, {
      onSuccess: () => setDeletingCurrency(null),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[hsl(var(--qota-teal))]" />
              Supported Currencies
            </CardTitle>
            <CardDescription>
              Manage available currencies across the system. Adding a currency here makes it available in all dropdowns.
            </CardDescription>
          </div>
          <Button variant="accent" onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Currency
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allCurrencies.map((currency) => {
                const isUSD = currency.code === "USD";
                return (
                  <TableRow key={currency.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {currency.code}
                      </Badge>
                    </TableCell>
                    <TableCell>{currency.name}</TableCell>
                    <TableCell className="font-medium">{currency.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={currency.is_active ? "default" : "secondary"}>
                        {currency.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isUSD ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Base currency
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(currency)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCheck(currency)}
                            disabled={deleteCheckLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Currency</DialogTitle>
            <DialogDescription>
              Add a new currency to the system. It will immediately appear in all currency dropdowns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Currency Code *</Label>
              <Input
                placeholder="e.g., JPY"
                maxLength={5}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">ISO 4217 currency code (2-5 characters)</p>
            </div>
            <div className="space-y-2">
              <Label>Currency Name *</Label>
              <Input
                placeholder="e.g., Japanese Yen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                placeholder="e.g., ¥"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Optional. If left blank, the currency code will be used as the display symbol.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Currency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCurrency} onOpenChange={(open) => !open && setEditingCurrency(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Currency - {editingCurrency?.code}</DialogTitle>
            <DialogDescription>
              Update currency details. Code cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Currency Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCurrency(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Currency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCurrency} onOpenChange={(open) => !open && setDeletingCurrency(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingCurrency?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deletingCurrency?.name} ({deletingCurrency?.code}) from the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
