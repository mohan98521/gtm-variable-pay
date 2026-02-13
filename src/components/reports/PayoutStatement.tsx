/**
 * Incentive Payout Statement Component
 * 
 * Displays detailed monthly payout breakdown with:
 * - Dual-currency display (USD and Local Currency)
 * - Dual-rate conversion (Compensation Rate for VP, Market Rate for Commissions)
 * - Three-way payout split breakdown
 * - Clawbacks section
 * - Summary totals
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronDown, 
  ChevronRight, 
  Download, 
  Printer, 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calculator,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { 
  usePayoutStatement, 
  usePayoutStatementForEmployee,
  useAvailablePayoutMonths,
  formatLocalCurrency,
  formatDualCurrency,
  type PayoutStatementData,
  type VariablePayItem,
  type CommissionItem,
  type AdditionalPayItem,
  type ReleaseItem,
  type ClawbackItem,
} from "@/hooks/usePayoutStatement";

interface PayoutStatementProps {
  employeeId?: string; // If provided, shows statement for this employee (admin view)
}

export function PayoutStatement({ employeeId }: PayoutStatementProps) {
  const { selectedYear } = useFiscalYear();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [vpExpanded, setVpExpanded] = useState(true);
  const [commExpanded, setCommExpanded] = useState(true);

  // Fetch available months
  const { data: availableMonths = [] } = useAvailablePayoutMonths(selectedYear);

  // Fetch statement data
  const { data: statement, isLoading, error } = employeeId
    ? usePayoutStatementForEmployee(employeeId, selectedMonth)
    : usePayoutStatement(selectedMonth);

  if (isLoading) {
    return <PayoutStatementSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>Error loading payout statement. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statement) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No payout data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with month selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Incentive Payout Statement</h2>
          <p className="text-muted-foreground">Detailed breakdown of your monthly payout</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  <div className="flex items-center gap-2">
                    {month.label}
                    {month.hasRun && (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statement Header Card */}
      <StatementHeader statement={statement} />

      {/* Variable Pay Section */}
      <VariablePaySection 
        items={statement.variablePayItems}
        compensationRate={statement.compensationRate}
        localCurrency={statement.localCurrency}
        expanded={vpExpanded}
        onToggle={() => setVpExpanded(!vpExpanded)}
      />

      {/* Commissions Section */}
      <CommissionsSection 
        items={statement.commissionItems}
        marketRate={statement.marketRate}
        localCurrency={statement.localCurrency}
        monthLabel={statement.monthLabel}
        expanded={commExpanded}
        onToggle={() => setCommExpanded(!commExpanded)}
      />

      {/* NRR / SPIFF Section */}
      <AdditionalPaySection 
        items={statement.additionalPayItems}
        localCurrency={statement.localCurrency}
      />

      {/* Releases Section */}
      <ReleasesSection 
        items={statement.releaseItems}
        localCurrency={statement.localCurrency}
      />

      {/* Clawbacks Section */}
      <ClawbacksSection 
        items={statement.clawbackItems}
        localCurrency={statement.localCurrency}
      />

      {/* Summary Section */}
      <SummarySection 
        summary={statement.summary}
        compensationRate={statement.compensationRate}
        marketRate={statement.marketRate}
        localCurrency={statement.localCurrency}
      />
    </div>
  );
}

// Sub-components

function StatementHeader({ statement }: { statement: PayoutStatementData }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-semibold">{statement.employeeName}</span>
              <Badge variant="outline">{statement.employeeCode}</Badge>
            </div>
            <p className="text-muted-foreground">Period: {statement.monthLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {statement.localCurrency}
            </Badge>
            {statement.isEstimated ? (
              <Badge variant="outline" className="border-warning text-warning">
                <Calculator className="h-3 w-3 mr-1" />
                Estimated
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className={getStatusBadgeClass(statement.runStatus)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {statement.runStatus?.charAt(0).toUpperCase() + statement.runStatus?.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBadgeClass(status: string | null): string {
  switch (status) {
    case 'paid':
      return 'border-success text-success';
    case 'finalized':
      return 'border-primary text-primary';
    case 'approved':
      return 'border-accent text-accent';
    default:
      return '';
  }
}

function VariablePaySection({ 
  items, 
  compensationRate, 
  localCurrency,
  expanded,
  onToggle,
}: { 
  items: VariablePayItem[];
  compensationRate: number;
  localCurrency: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalGrossUsd = items.reduce((sum, v) => sum + v.grossUsd, 0);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Variable Pay</CardTitle>
          </div>
          <CardDescription>
            using Compensation Rate: {compensationRate.toFixed(2)} {localCurrency}/USD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No variable pay for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Variable Pay</CardTitle>
              <Badge variant="secondary">${totalGrossUsd.toLocaleString()}</Badge>
            </div>
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CardDescription>
            using Compensation Rate: {compensationRate.toFixed(2)} {localCurrency}/USD
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <MetricPayoutCard 
                key={index} 
                item={item} 
                localCurrency={localCurrency}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MetricPayoutCard({ 
  item, 
  localCurrency 
}: { 
  item: VariablePayItem;
  localCurrency: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.metricName}</span>
        <Badge variant="outline">{item.multiplier.toFixed(1)}x</Badge>
      </div>
      
      {item.target > 0 && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Target:</span>
            <span className="ml-2 font-medium">${item.target.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Actual:</span>
            <span className="ml-2 font-medium">${item.actual.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Achievement:</span>
            <span className="ml-2 font-medium">{item.achievementPct.toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      <Separator />
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gross Variable Pay:</span>
          <span className="font-semibold">
            {formatDualCurrency(item.grossUsd, item.grossLocal, localCurrency)}
          </span>
        </div>
        
        <div className="ml-4 space-y-1 text-sm">
          <div className="flex justify-between text-success">
            <span>├── Paid on Booking:</span>
            <span>{formatDualCurrency(item.paidOnBookingUsd, item.paidOnBookingLocal, localCurrency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>├── Held for Collection:</span>
            <span>{formatDualCurrency(item.heldForCollectionUsd, item.heldForCollectionLocal, localCurrency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>└── Held for Year-End:</span>
            <span>{formatDualCurrency(item.heldForYearEndUsd, item.heldForYearEndLocal, localCurrency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommissionsSection({ 
  items, 
  marketRate, 
  localCurrency,
  monthLabel,
  expanded,
  onToggle,
}: { 
  items: CommissionItem[];
  marketRate: number;
  localCurrency: string;
  monthLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalGrossUsd = items.reduce((sum, c) => sum + c.grossUsd, 0);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg">Commissions</CardTitle>
          </div>
          <CardDescription>
            using Market Rate: {marketRate.toFixed(2)} {localCurrency}/USD for {monthLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No commissions for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg">Commissions</CardTitle>
              <Badge variant="secondary">${totalGrossUsd.toLocaleString()}</Badge>
            </div>
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CardDescription>
            using Market Rate: {marketRate.toFixed(2)} {localCurrency}/USD for {monthLabel}
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <CommissionPayoutCard 
                key={index} 
                item={item} 
                localCurrency={localCurrency}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CommissionPayoutCard({ 
  item, 
  localCurrency 
}: { 
  item: CommissionItem;
  localCurrency: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.commissionType}</span>
        {item.isLinkedToImpl && (
          <Badge variant="outline" className="text-warning border-warning">
            <Clock className="h-3 w-3 mr-1" />
            Linked to Impl
          </Badge>
        )}
      </div>
      
      {item.dealValue > 0 && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Deal Value:</span>
            <span className="ml-2 font-medium">${item.dealValue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rate:</span>
            <span className="ml-2 font-medium">{item.rate}%</span>
          </div>
        </div>
      )}
      
      <Separator />
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gross Commission:</span>
          <span className="font-semibold">
            {formatDualCurrency(item.grossUsd, item.grossLocal, localCurrency)}
          </span>
        </div>
        
        <div className="ml-4 space-y-1 text-sm">
          <div className="flex justify-between text-success">
            <span>├── Paid on Booking:</span>
            <span>{formatDualCurrency(item.paidOnBookingUsd, item.paidOnBookingLocal, localCurrency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>├── Held for Collection:</span>
            <span>{formatDualCurrency(item.heldForCollectionUsd, item.heldForCollectionLocal, localCurrency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>└── Held for Year-End:</span>
            <span>{formatDualCurrency(item.heldForYearEndUsd, item.heldForYearEndLocal, localCurrency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClawbacksSection({ 
  items, 
  localCurrency 
}: { 
  items: ClawbackItem[];
  localCurrency: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">Clawbacks</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground">None this month</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-sm">{item.description}</span>
                <span className="font-medium text-destructive">
                  -{formatDualCurrency(item.amountUsd, item.amountLocal, localCurrency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdditionalPaySection({ 
  items, 
  localCurrency 
}: { 
  items: AdditionalPayItem[];
  localCurrency: string;
}) {
  if (items.length === 0) return null;

  const totalGrossUsd = items.reduce((sum, a) => sum + a.grossUsd, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">NRR / SPIFF</CardTitle>
            <Badge variant="secondary">${totalGrossUsd.toLocaleString()}</Badge>
          </div>
        </div>
        <CardDescription>Additional performance-based pay</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{item.payoutType}</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Amount:</span>
                <span className="font-semibold">
                  {formatDualCurrency(item.grossUsd, item.grossLocal, localCurrency)}
                </span>
              </div>
              <div className="ml-4 space-y-1 text-sm">
                <div className="flex justify-between text-success">
                  <span>├── Paid on Booking:</span>
                  <span>{formatDualCurrency(item.paidOnBookingUsd, item.paidOnBookingLocal, localCurrency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>├── Held for Collection:</span>
                  <span>{formatDualCurrency(item.heldForCollectionUsd, item.heldForCollectionLocal, localCurrency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>└── Held for Year-End:</span>
                  <span>{formatDualCurrency(item.heldForYearEndUsd, item.heldForYearEndLocal, localCurrency)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ReleasesSection({ 
  items, 
  localCurrency 
}: { 
  items: ReleaseItem[];
  localCurrency: string;
}) {
  if (items.length === 0) return null;

  const totalUsd = items.reduce((sum, r) => sum + r.grossUsd, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <CardTitle className="text-lg">Releases</CardTitle>
          <Badge variant="secondary">${totalUsd.toLocaleString()}</Badge>
        </div>
        <CardDescription>Collection and year-end holdback releases</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-success/10 border border-success/20">
              <span className="text-sm font-medium">{item.releaseType}</span>
              <span className="font-medium text-success">
                +{formatDualCurrency(item.grossUsd, item.grossLocal, localCurrency)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummarySection({
  summary, 
  compensationRate, 
  marketRate,
  localCurrency 
}: { 
  summary: PayoutStatementData['summary'];
  compensationRate: number;
  marketRate: number;
  localCurrency: string;
}) {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paid This Month */}
        <div className="space-y-3">
          <h4 className="font-semibold text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            PAID THIS MONTH
          </h4>
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Variable Pay @ {compensationRate.toFixed(2)} (Comp Rate):</span>
              <span className="font-medium">
                {formatDualCurrency(summary.vpPaidUsd, summary.vpPaidLocal, localCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Commissions @ {marketRate.toFixed(2)} (Market Rate):</span>
              <span className="font-medium">
                {formatDualCurrency(summary.commPaidUsd, summary.commPaidLocal, localCurrency)}
              </span>
            </div>
            {(summary.additionalPayPaidUsd > 0 || summary.additionalPayPaidLocal > 0) && (
              <div className="flex justify-between">
                <span>NRR / SPIFF:</span>
                <span className="font-medium">
                  {formatDualCurrency(summary.additionalPayPaidUsd, summary.additionalPayPaidLocal, localCurrency)}
                </span>
              </div>
            )}
            {(summary.releaseUsd > 0 || summary.releaseLocal > 0) && (
              <div className="flex justify-between">
                <span>Releases:</span>
                <span className="font-medium">
                  {formatDualCurrency(summary.releaseUsd, summary.releaseLocal, localCurrency)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total Paid:</span>
              <span className="text-success">
                {formatDualCurrency(summary.totalPaidUsd, summary.totalPaidLocal, localCurrency)}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Held for Later */}
        <div className="space-y-3">
          <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            HELD FOR LATER
          </h4>
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>For Collection:</span>
              <span className="font-medium">
                {formatDualCurrency(summary.heldCollectionUsd, summary.heldCollectionLocal, localCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>For Year-End:</span>
              <span className="font-medium">
                {formatDualCurrency(summary.heldYearEndUsd, summary.heldYearEndLocal, localCurrency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PayoutStatementSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
