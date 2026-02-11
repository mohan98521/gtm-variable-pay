import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { AUDIT_DOMAINS, AUDIT_ACTION_TYPES, type UnifiedAuditFilters } from "@/hooks/useUnifiedAuditLog";

interface AuditFiltersProps {
  filters: UnifiedAuditFilters;
  onFiltersChange: (filters: UnifiedAuditFilters) => void;
}

export function AuditFilters({ filters, onFiltersChange }: AuditFiltersProps) {
  const update = (partial: Partial<UnifiedAuditFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  const hasActiveFilters = !!(
    filters.domains?.length ||
    filters.actions?.length ||
    filters.searchTerm ||
    filters.retroactiveOnly ||
    filters.rateMismatchOnly
  );

  const clearFilters = () =>
    onFiltersChange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

  return (
    <div className="space-y-4">
      {/* Row 1: Search + Date Range */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events, tables, reasons..."
              value={filters.searchTerm || ""}
              onChange={(e) => update({ searchTerm: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => update({ startDate: e.target.value })}
            className="w-[150px]"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) => update({ endDate: e.target.value })}
            className="w-[150px]"
          />
        </div>
      </div>

      {/* Row 2: Domain, Action, Toggles */}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchableSelect
          value={filters.domains?.[0] || "all"}
          onValueChange={(v) => update({ domains: v === "all" ? undefined : [v] })}
          options={[
            { value: "all", label: "All Domains" },
            ...AUDIT_DOMAINS.map((d) => ({ value: d.value, label: d.label })),
          ]}
          placeholder="Domain"
          searchPlaceholder="Search domains..."
          className="w-[170px]"
        />
        <SearchableSelect
          value={filters.actions?.[0] || "all"}
          onValueChange={(v) => update({ actions: v === "all" ? undefined : [v] })}
          options={[
            { value: "all", label: "All Actions" },
            ...AUDIT_ACTION_TYPES.map((a) => ({ value: a.value, label: a.label })),
          ]}
          placeholder="Action"
          searchPlaceholder="Search actions..."
          className="w-[180px]"
        />

        <div className="flex items-center gap-2 ml-2">
          <Switch
            id="retroactive"
            checked={filters.retroactiveOnly || false}
            onCheckedChange={(v) => update({ retroactiveOnly: v })}
          />
          <Label htmlFor="retroactive" className="text-sm cursor-pointer">
            Retroactive Only
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="mismatch"
            checked={filters.rateMismatchOnly || false}
            onCheckedChange={(v) => update({ rateMismatchOnly: v })}
          />
          <Label htmlFor="mismatch" className="text-sm cursor-pointer">
            Rate Mismatches
          </Label>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
