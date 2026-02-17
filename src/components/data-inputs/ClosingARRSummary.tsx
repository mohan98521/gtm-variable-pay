import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  CheckCircle,
  DollarSign,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { ClosingARRActual, calculateClosingARRSummary } from "@/hooks/useClosingARR";
import { findRenewalMultiplier, ClosingArrRenewalMultiplier } from "@/hooks/useClosingArrRenewalMultipliers";

interface ClosingARRSummaryProps {
  records: ClosingARRActual[];
  fiscalYear: number;
  multipliers?: ClosingArrRenewalMultiplier[];
}

export function ClosingARRSummary({ records, fiscalYear, multipliers = [] }: ClosingARRSummaryProps) {
  const summary = calculateClosingARRSummary(records, fiscalYear);

  // Calculate adjusted eligible ARR
  const fiscalYearEnd = new Date(fiscalYear, 11, 31);
  const adjustedEligibleClosingARR = records
    .filter((r) => r.end_date && new Date(r.end_date) > fiscalYearEnd)
    .reduce((sum, r) => {
      const mult = r.is_multi_year ? findRenewalMultiplier(multipliers, r.renewal_years) : 1.0;
      return sum + (r.closing_arr || 0) * mult;
    }, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const changePercent = summary.totalOpeningARR > 0
    ? ((summary.totalChanges / summary.totalOpeningARR) * 100).toFixed(1)
    : "0";

  const isPositiveChange = summary.totalChanges >= 0;

  const hasMultiplierImpact = adjustedEligibleClosingARR !== summary.eligibleClosingARR;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {/* Total Projects */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="text-2xl font-semibold text-foreground">{summary.totalProjects}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening ARR */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Opening ARR</p>
              <p className="text-2xl font-semibold text-foreground" title={formatFullCurrency(summary.totalOpeningARR)}>
                {formatCurrency(summary.totalOpeningARR)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Changes */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-md ${
              isPositiveChange ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
              {isPositiveChange ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Changes</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-semibold ${isPositiveChange ? "text-success" : "text-destructive"}`}
                   title={formatFullCurrency(summary.totalChanges)}>
                  {isPositiveChange ? "+" : ""}{formatCurrency(summary.totalChanges)}
                </p>
                <Badge variant={isPositiveChange ? "default" : "destructive"} className="text-xs">
                  {isPositiveChange ? "+" : ""}{changePercent}%
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closing ARR */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Closing ARR</p>
              <p className="text-2xl font-semibold text-foreground" title={formatFullCurrency(summary.totalClosingARR)}>
                {formatCurrency(summary.totalClosingARR)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible Projects */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eligible Projects</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold text-foreground">{summary.eligibleProjects}</p>
                <span className="text-xs text-muted-foreground">
                  / {summary.totalProjects}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible Closing ARR */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/20 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eligible Closing ARR</p>
              <p className="text-2xl font-semibold text-primary" title={formatFullCurrency(summary.eligibleClosingARR)}>
                {formatCurrency(summary.eligibleClosingARR)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                End date &gt; Dec 31, {fiscalYear}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjusted Eligible ARR */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-500/20 text-amber-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Adjusted Eligible ARR</p>
              <p className="text-2xl font-semibold text-amber-600" title={formatFullCurrency(adjustedEligibleClosingARR)}>
                {formatCurrency(adjustedEligibleClosingARR)}
              </p>
              {hasMultiplierImpact && (
                <p className="text-xs text-amber-600/70 mt-0.5">
                  Includes multi-year uplift
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}