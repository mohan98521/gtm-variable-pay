import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MultiplierRow {
  id?: string;
  min_pct: number;
  max_pct: number;
  multiplier_value: number;
  isNew?: boolean;
}

interface MultiplierGridEditorProps {
  planMetricId: string;
  metricName: string;
  logicType: string;
  existingMultipliers: Array<{
    id: string;
    min_pct: number;
    max_pct: number;
    multiplier_value: number;
  }>;
}

export function MultiplierGridEditor({
  planMetricId,
  metricName,
  logicType,
  existingMultipliers,
}: MultiplierGridEditorProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<MultiplierRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (existingMultipliers.length > 0) {
      setRows(existingMultipliers.map(m => ({ ...m })));
    } else {
      // Default multiplier grid based on logic type
      if (logicType === "Stepped_Accelerator") {
        setRows([
          { min_pct: 0, max_pct: 100, multiplier_value: 1.0, isNew: true },
          { min_pct: 100, max_pct: 120, multiplier_value: 1.4, isNew: true },
          { min_pct: 120, max_pct: 999, multiplier_value: 1.6, isNew: true },
        ]);
      } else if (logicType === "Gated_Threshold") {
        setRows([
          { min_pct: 0, max_pct: 85, multiplier_value: 0, isNew: true },
          { min_pct: 85, max_pct: 95, multiplier_value: 0.8, isNew: true },
          { min_pct: 95, max_pct: 100, multiplier_value: 1.0, isNew: true },
          { min_pct: 100, max_pct: 999, multiplier_value: 1.2, isNew: true },
        ]);
      } else {
        setRows([
          { min_pct: 0, max_pct: 999, multiplier_value: 1.0, isNew: true },
        ]);
      }
      setHasChanges(true);
    }
  }, [existingMultipliers, logicType]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing multipliers
      const { error: deleteError } = await supabase
        .from("multiplier_grids")
        .delete()
        .eq("plan_metric_id", planMetricId);
      
      if (deleteError) throw deleteError;

      // Insert new multipliers
      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("multiplier_grids")
          .insert(
            rows.map(row => ({
              plan_metric_id: planMetricId,
              min_pct: row.min_pct,
              max_pct: row.max_pct,
              multiplier_value: row.multiplier_value,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan_metrics_with_grids"] });
      setHasChanges(false);
      toast({ title: "Saved", description: "Multiplier grid saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    const newMinPct = lastRow ? lastRow.max_pct : 0;
    setRows([
      ...rows,
      { min_pct: newMinPct, max_pct: newMinPct + 20, multiplier_value: 1.0, isNew: true },
    ]);
    setHasChanges(true);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateRow = (index: number, field: keyof MultiplierRow, value: number) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
    setHasChanges(true);
  };

  // Validation: check for gaps or overlaps
  const validateGrid = (): string | null => {
    if (rows.length === 0) return "At least one multiplier tier is required";
    
    const sortedRows = [...rows].sort((a, b) => a.min_pct - b.min_pct);
    
    for (let i = 0; i < sortedRows.length; i++) {
      if (sortedRows[i].min_pct >= sortedRows[i].max_pct) {
        return `Row ${i + 1}: Min must be less than Max`;
      }
      if (i > 0 && sortedRows[i].min_pct < sortedRows[i - 1].max_pct) {
        return `Overlap detected between tiers`;
      }
    }
    
    return null;
  };

  const validationError = validateGrid();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">{metricName}</CardTitle>
            <CardDescription className="text-xs">
              {logicType.replace(/_/g, " ")} multiplier grid
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" />
              Add Tier
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges || !!validationError}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save Grid
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {validationError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Min Achievement (%)</TableHead>
              <TableHead className="w-[140px]">Max Achievement (%)</TableHead>
              <TableHead className="w-[140px]">Multiplier</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    type="number"
                    value={row.min_pct}
                    onChange={(e) => updateRow(index, "min_pct", Number(e.target.value))}
                    className="h-8"
                    min={0}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.max_pct}
                    onChange={(e) => updateRow(index, "max_pct", Number(e.target.value))}
                    className="h-8"
                    min={0}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.multiplier_value}
                    onChange={(e) => updateRow(index, "multiplier_value", Number(e.target.value))}
                    className="h-8"
                    step={0.1}
                    min={0}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeRow(index)}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-xs text-muted-foreground mt-3">
          Define achievement ranges and their corresponding multipliers. Use 999 for "unlimited" max values.
        </p>
      </CardContent>
    </Card>
  );
}
