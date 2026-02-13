import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, TrendingUp, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface NrrSettingsCardProps {
  planId: string;
  nrrOtePercent: number;
  crErMinGpMarginPct: number;
  implMinGpMarginPct: number;
}

export function NrrSettingsCard({
  planId,
  nrrOtePercent,
  crErMinGpMarginPct,
  implMinGpMarginPct,
}: NrrSettingsCardProps) {
  const queryClient = useQueryClient();
  const [nrrOte, setNrrOte] = useState(nrrOtePercent);
  const [crErGp, setCrErGp] = useState(crErMinGpMarginPct);
  const [implGp, setImplGp] = useState(implMinGpMarginPct);

  useEffect(() => {
    setNrrOte(nrrOtePercent);
    setCrErGp(crErMinGpMarginPct);
    setImplGp(implMinGpMarginPct);
  }, [nrrOtePercent, crErMinGpMarginPct, implMinGpMarginPct]);

  const hasChanges =
    nrrOte !== nrrOtePercent ||
    crErGp !== crErMinGpMarginPct ||
    implGp !== implMinGpMarginPct;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comp_plans")
        .update({
          nrr_ote_percent: nrrOte,
          cr_er_min_gp_margin_pct: crErGp,
          impl_min_gp_margin_pct: implGp,
        })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plan", planId] });
      toast({ title: "NRR settings saved", description: "NRR Additional Pay configuration updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
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
          {hasChanges && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="nrr-ote">NRR OTE Allocation (%)</Label>
            <Input
              id="nrr-ote"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={nrrOte}
              onChange={(e) => setNrrOte(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 20"
            />
            <p className="text-xs text-muted-foreground">
              % of Variable OTE for NRR additional pay
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crer-gp">CR/ER Min GP Margin (%)</Label>
            <Input
              id="crer-gp"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={crErGp}
              onChange={(e) => setCrErGp(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 15"
            />
            <p className="text-xs text-muted-foreground">
              Minimum gross profit margin for CR/ER eligibility
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="impl-gp">Implementation Min GP Margin (%)</Label>
            <Input
              id="impl-gp"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={implGp}
              onChange={(e) => setImplGp(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-muted-foreground">
              Minimum gross profit margin for Implementation eligibility
            </p>
          </div>
        </div>

        <Separator />

        <div className="rounded-md bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Info className="h-4 w-4 text-muted-foreground" />
            How NRR Additional Pay Works
          </div>
          <p className="text-sm text-muted-foreground">
            Deals below the margin threshold will not count toward NRR achievement.
            Only eligible CR/ER and Implementation amounts are combined as NRR Actuals.
          </p>
          <div className="text-sm font-mono bg-background rounded-md px-3 py-2 text-muted-foreground border">
            NRR Pay = Variable OTE × {nrrOte || "NRR"}% × (Eligible NRR Actuals ÷ NRR Target)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
