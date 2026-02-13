import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { PlanSpiff } from "@/hooks/usePlanSpiffs";

interface SpiffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spiff: PlanSpiff | null;
  metricNames: string[];
  onSubmit: (values: {
    spiff_name: string;
    description?: string | null;
    linked_metric_name: string;
    spiff_rate_pct: number;
    min_deal_value_usd?: number | null;
    is_active: boolean;
    payout_on_booking_pct: number;
    payout_on_collection_pct: number;
    payout_on_year_end_pct: number;
  }) => void;
  isSubmitting: boolean;
}

export function SpiffFormDialog({
  open,
  onOpenChange,
  spiff,
  metricNames,
  onSubmit,
  isSubmitting,
}: SpiffFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMetric, setLinkedMetric] = useState("");
  const [ratePct, setRatePct] = useState(0);
  const [minDealValue, setMinDealValue] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [bookingPct, setBookingPct] = useState(0);
  const [collectionPct, setCollectionPct] = useState(100);
  const [yearEndPct, setYearEndPct] = useState(0);

  useEffect(() => {
    if (spiff) {
      setName(spiff.spiff_name);
      setDescription(spiff.description || "");
      setLinkedMetric(spiff.linked_metric_name);
      setRatePct(spiff.spiff_rate_pct);
      setMinDealValue(spiff.min_deal_value_usd?.toString() || "");
      setIsActive(spiff.is_active);
      setBookingPct(spiff.payout_on_booking_pct ?? 0);
      setCollectionPct(spiff.payout_on_collection_pct ?? 100);
      setYearEndPct(spiff.payout_on_year_end_pct ?? 0);
    } else {
      setName("");
      setDescription("");
      setLinkedMetric(metricNames[0] || "");
      setRatePct(25);
      setMinDealValue("");
      setIsActive(true);
      setBookingPct(0);
      setCollectionPct(100);
      setYearEndPct(0);
    }
  }, [spiff, metricNames, open]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      spiff_name: name,
      description: description || null,
      linked_metric_name: linkedMetric,
      spiff_rate_pct: ratePct,
      min_deal_value_usd: minDealValue ? parseFloat(minDealValue) : null,
      is_active: isActive,
      payout_on_booking_pct: bookingPct,
      payout_on_collection_pct: collectionPct,
      payout_on_year_end_pct: yearEndPct,
    });
  };

  const isValid = name.trim() && linkedMetric && ratePct > 0 && payoutSum === 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{spiff ? "Edit SPIFF" : "Add SPIFF"}</DialogTitle>
          <DialogDescription>
            Configure a SPIFF bonus linked to a plan metric
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spiff-name">SPIFF Name</Label>
            <Input
              id="spiff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Large Deal SPIFF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spiff-desc">Description (optional)</Label>
            <Input
              id="spiff-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
            />
          </div>

          <div className="space-y-2">
            <Label>Linked Metric</Label>
            <Select value={linkedMetric} onValueChange={setLinkedMetric}>
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {metricNames.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The metric whose weightage determines the OTE portion for this SPIFF
            </p>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="spiff-rate">SPIFF Rate (%)</Label>
              <Input
                id="spiff-rate"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={ratePct}
                onChange={(e) => setRatePct(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spiff-min-deal">Min Deal Value (USD)</Label>
              <Input
                id="spiff-min-deal"
                type="number"
                min={0}
                step={1000}
                value={minDealValue}
                onChange={(e) => setMinDealValue(e.target.value)}
                placeholder="e.g. 400000"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="spiff-active" className="cursor-pointer">Active</Label>
              <p className="text-xs text-muted-foreground">Enable this SPIFF for payout calculations</p>
            </div>
            <Switch
              id="spiff-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {spiff ? "Update" : "Add"} SPIFF
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
