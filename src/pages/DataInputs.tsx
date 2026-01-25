import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, FileSpreadsheet, CheckCircle, Clock, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DealsTable } from "@/components/data-inputs/DealsTable";
import { DealFormDialog } from "@/components/data-inputs/DealFormDialog";
import { DealsBulkUpload } from "@/components/data-inputs/DealsBulkUpload";
import { useDeals, DealWithParticipants, METRIC_TYPES } from "@/hooks/useDeals";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { format } from "date-fns";

export default function DataInputs() {
  const { selectedYear, getMonthsForYear } = useFiscalYear();
  const monthOptions = useMemo(() => getMonthsForYear(selectedYear), [selectedYear, getMonthsForYear]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentMonth = format(new Date(), "yyyy-MM-01");
    const yearMatch = monthOptions.find(m => m.value === currentMonth);
    return yearMatch ? currentMonth : (monthOptions[0]?.value || currentMonth);
  });
  const [selectedMetricType, setSelectedMetricType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithParticipants | null>(null);

  // Fetch deals based on filters
  const { data: deals = [], isLoading } = useDeals(
    selectedMonth,
    selectedMetricType === "all" ? undefined : selectedMetricType
  );

  const handleAddDeal = (metricType?: string) => {
    setEditingDeal(null);
    setDialogOpen(true);
  };

  const handleEditDeal = (deal: DealWithParticipants) => {
    setEditingDeal(deal);
    setDialogOpen(true);
  };

  // Calculate stats
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, d) => sum + d.deal_value_usd, 0);
  const statusCounts = deals.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Filter deals by metric type for tabs
  const getDealsForMetric = (metricType: string) => {
    if (metricType === "all") return deals;
    return deals.filter((d) => d.metric_type === metricType);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Data Inputs</h1>
            <p className="text-muted-foreground">Manage deal-level actuals and participant assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Bulk Upload
            </Button>
            <Button onClick={() => handleAddDeal()}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Deal
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                  <p className="text-2xl font-semibold text-foreground">{totalDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {statusCounts.approved || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {(statusCounts.draft || 0) + (statusCounts.submitted || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Value (USD)</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(totalValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedMonth), "MMMM yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deals Table with Metric Type Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deals by Metric Type</CardTitle>
            <CardDescription>
              View and manage deals categorized by metric type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedMetricType} onValueChange={setSelectedMetricType}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="all" className="text-xs">
                  All
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {deals.length}
                  </Badge>
                </TabsTrigger>
                {METRIC_TYPES.map((type) => {
                  const count = deals.filter((d) => d.metric_type === type.value).length;
                  return (
                    <TabsTrigger key={type.value} value={type.value} className="text-xs">
                      {type.label.split(" ")[0]}
                      {count > 0 && (
                        <Badge variant="secondary" className="ml-1.5 text-xs">
                          {count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="all">
                <DealsTable
                  deals={deals}
                  onEdit={handleEditDeal}
                  isLoading={isLoading}
                />
              </TabsContent>

              {METRIC_TYPES.map((type) => (
                <TabsContent key={type.value} value={type.value}>
                  <DealsTable
                    deals={getDealsForMetric(type.value)}
                    onEdit={handleEditDeal}
                    isLoading={isLoading}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Deal Form Dialog */}
        <DealFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          deal={editingDeal}
          defaultMonth={selectedMonth}
          defaultMetricType={selectedMetricType === "all" ? undefined : selectedMetricType}
        />

        {/* Bulk Upload Dialog */}
        <DealsBulkUpload
          open={bulkUploadOpen}
          onOpenChange={setBulkUploadOpen}
        />
      </div>
    </AppLayout>
  );
}
