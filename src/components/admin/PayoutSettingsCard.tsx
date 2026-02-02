import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const PAYOUT_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "annual", label: "Annual" },
] as const;

export type PayoutFrequency = typeof PAYOUT_FREQUENCIES[number]["value"];

interface PayoutSettingsCardProps {
  planId: string;
  payoutFrequency?: string;
  clawbackPeriodDays?: number;
}

export function PayoutSettingsCard({
  planId,
  payoutFrequency = "monthly",
  clawbackPeriodDays = 180,
}: PayoutSettingsCardProps) {
  const queryClient = useQueryClient();
  const [frequency, setFrequency] = useState(payoutFrequency);
  const [clawbackDays, setClawbackDays] = useState(clawbackPeriodDays);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFrequency(payoutFrequency);
    setClawbackDays(clawbackPeriodDays);
    setIsDirty(false);
  }, [payoutFrequency, clawbackPeriodDays]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comp_plans")
        .update({
          payout_frequency: frequency,
          clawback_period_days: clawbackDays,
        })
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp_plan", planId] });
      setIsDirty(false);
      toast({
        title: "Payout settings updated",
        description: "The payout configuration has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFrequencyChange = (value: string) => {
    setFrequency(value);
    setIsDirty(true);
  };

  const handleClawbackChange = (value: string) => {
    const days = parseInt(value, 10) || 0;
    setClawbackDays(days);
    setIsDirty(true);
  };

  const handleSave = () => {
    updateMutation.mutate();
  };

  const handleReset = () => {
    setFrequency(payoutFrequency);
    setClawbackDays(clawbackPeriodDays);
    setIsDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Payout Settings
        </CardTitle>
        <CardDescription>
          Configure payout frequency and clawback period for this compensation plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Payout Frequency */}
          <div className="space-y-2">
            <Label htmlFor="payout-frequency">Payout Frequency</Label>
            <Select value={frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger id="payout-frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often incentive payouts are calculated and distributed
            </p>
          </div>

          {/* Clawback Period */}
          <div className="space-y-2">
            <Label htmlFor="clawback-period">Clawback Period (Days)</Label>
            <div className="relative">
              <RotateCcw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="clawback-period"
                type="number"
                min={0}
                max={365}
                value={clawbackDays}
                onChange={(e) => handleClawbackChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              First invoice must be collected within this period from booking month end.
              Default: 180 days. If not collected, payout is clawed back.
            </p>
          </div>
        </div>

        {/* Save Button */}
        {isDirty && (
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
