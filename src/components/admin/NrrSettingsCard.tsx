import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, Loader2, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface NrrSettingsCardProps {
  planId: string;
  nrrOtePercent: number;
  crErMinGpMarginPct: number;
  implMinGpMarginPct: number;
  nrrPayoutOnBookingPct: number;
  nrrPayoutOnCollectionPct: number;
  nrrPayoutOnYearEndPct: number;
}

export function NrrSettingsCard({
  planId,
  nrrOtePercent,
  crErMinGpMarginPct,
  implMinGpMarginPct,
  nrrPayoutOnBookingPct,
  nrrPayoutOnCollectionPct,
  nrrPayoutOnYearEndPct,
}: NrrSettingsCardProps) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isConfigured = nrrOtePercent > 0;

  // Form state
  const [nrrOte, setNrrOte] = useState(nrrOtePercent);
  const [crErGp, setCrErGp] = useState(crErMinGpMarginPct);
  const [implGp, setImplGp] = useState(implMinGpMarginPct);
  const [bookingPct, setBookingPct] = useState(nrrPayoutOnBookingPct);
  const [collectionPct, setCollectionPct] = useState(nrrPayoutOnCollectionPct);
  const [yearEndPct, setYearEndPct] = useState(nrrPayoutOnYearEndPct);

  useEffect(() => {
    if (showDialog) {
      setNrrOte(nrrOtePercent);
      setCrErGp(crErMinGpMarginPct);
      setImplGp(implMinGpMarginPct);
      setBookingPct(nrrPayoutOnBookingPct);
      setCollectionPct(nrrPayoutOnCollectionPct);
      setYearEndPct(nrrPayoutOnYearEndPct);
    }
  }, [showDialog, nrrOtePercent, crErMinGpMarginPct, implMinGpMarginPct, nrrPayoutOnBookingPct, nrrPayoutOnCollectionPct, nrrPayoutOnYearEndPct]);

  const payoutSum = (bookingPct || 0) + (collectionPct || 0) + (yearEndPct || 0);

  const handleBookingChange = (value: number) => {
    const v = Math.min(100, Math.max(0, value || 0));
    setBookingPct(v);
    const remaining = 100 - v;
    if (collectionPct > remaining) {
      setCollectionPct(remaining);
      setYearEndPct(0);
    } else {
      setYearEndPct(remaining - collectionPct);
    }
  };

  const handleCollectionChange = (value: number) => {
    const v = Math.min(100, Math.max(0, value || 0));
    setCollectionPct(v);
    const remaining = 100 - bookingPct - v;
    if (remaining >= 0) {
      setYearEndPct(remaining);
    } else {
      setBookingPct(Math.max(0, bookingPct + remaining));
      setYearEndPct(0);
    }
  };

  const handleYearEndChange = (value: number) => {
    const v = Math.min(100, Math.max(0, value || 0));
    setYearEndPct(v);
    const remaining = 100 - bookingPct - v;
    if (remaining >= 0) {
      setCollectionPct(remaining);
    } else {
      setBookingPct(Math.max(0, bookingPct + remaining));
      setCollectionPct(0);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comp_plans")
        .update({
          nrr_ote_percent: nrrOte,
          cr_er_min_gp_margin_pct: crErGp,
          impl_min_gp_margin_pct: implGp,
          nrr_payout_on_booking_pct: bookingPct,
          nrr_payout_on_collection_pct: collectionPct,
          nrr_payout_on_year_end_pct: yearEndPct,
        })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plan_with_metrics", planId] });
      toast({ title: "NRR settings saved", description: "NRR Additional Pay configuration updated." });
      setShowDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comp_plans")
        .update({
          nrr_ote_percent: 0,
          cr_er_min_gp_margin_pct: 0,
          impl_min_gp_margin_pct: 0,
          nrr_payout_on_booking_pct: 0,
          nrr_payout_on_collection_pct: 100,
          nrr_payout_on_year_end_pct: 0,
        })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plan_with_metrics", planId] });
      toast({ title: "NRR settings removed", description: "NRR Additional Pay has been reset." });
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isValid = nrrOte > 0 && payoutSum === 100;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">NRR Additional Pay</CardTitle>
                <CardDescription>
                  Non-Recurring Revenue (CR/ER + Implementation) additional OTE allocation
                </CardDescription>
              </div>
            </div>
            {!isConfigured && (
              <Button variant="accent" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add NRR Settings
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isConfigured ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No NRR Additional Pay Configured</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Configure NRR Additional Pay to enable bonus calculations based on CR/ER and Implementation revenue.
              </p>
              <Button variant="accent" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add NRR Settings
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NRR OTE (%)</TableHead>
                  <TableHead className="text-center">CR/ER Min GP (%)</TableHead>
                  <TableHead className="text-center">Impl Min GP (%)</TableHead>
                  <TableHead className="text-center">Payout Split</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Badge variant="outline">{nrrOtePercent}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{crErMinGpMarginPct}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{implMinGpMarginPct}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center text-xs">
                      <span className="text-muted-foreground">{nrrPayoutOnBookingPct}% Booking</span>
                      <span className="text-muted-foreground">{nrrPayoutOnCollectionPct}% Collection</span>
                      <span className="text-muted-foreground">{nrrPayoutOnYearEndPct}% Year End</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDialog(true)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Add Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isConfigured ? "Edit NRR Settings" : "Add NRR Settings"}</DialogTitle>
            <DialogDescription>
              Configure NRR Additional Pay allocation and payout timing for this plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="nrr-ote">NRR OTE (%)</Label>
                <Input
                  id="nrr-ote"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={nrrOte}
                  onChange={(e) => setNrrOte(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">% of Variable OTE</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="crer-gp">CR/ER Min GP (%)</Label>
                <Input
                  id="crer-gp"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={crErGp}
                  onChange={(e) => setCrErGp(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Min GP margin for CR/ER</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="impl-gp">Impl Min GP (%)</Label>
                <Input
                  id="impl-gp"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={implGp}
                  onChange={(e) => setImplGp(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Min GP for Implementation</p>
              </div>
            </div>

            {/* Payout Split Section */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Payout Split</h4>
                {payoutSum !== 100 && (
                  <div className="flex items-center gap-1 text-warning text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Must sum to 100% (currently {payoutSum}%)</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Upon Bookings (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={bookingPct}
                    onChange={(e) => handleBookingChange(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Paid on booking</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Upon Collections (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={collectionPct}
                    onChange={(e) => handleCollectionChange(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Held until collected</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">At Year End (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={yearEndPct}
                    onChange={(e) => handleYearEndChange(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Released in December</p>
                </div>
              </div>
            </div>

            {/* Formula info */}
            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4 text-muted-foreground" />
                Formula
              </div>
              <div className="text-sm font-mono bg-background rounded-md px-3 py-2 text-muted-foreground border">
                NRR Pay = Variable OTE × {nrrOte || "NRR"}% × (Eligible NRR Actuals ÷ NRR Target)
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isConfigured ? "Save Changes" : "Add NRR Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove NRR Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the NRR Additional Pay configuration? This will reset all NRR settings to zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
