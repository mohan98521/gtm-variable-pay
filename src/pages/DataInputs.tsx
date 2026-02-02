import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Calendar, FileSpreadsheet, CheckCircle, Clock, Upload, BarChart3, Wallet } from "lucide-react";
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
import { ClosingARRTable } from "@/components/data-inputs/ClosingARRTable";
import { ClosingARRFormDialog } from "@/components/data-inputs/ClosingARRFormDialog";
import { ClosingARRBulkUpload } from "@/components/data-inputs/ClosingARRBulkUpload";
import { ClosingARRSummary } from "@/components/data-inputs/ClosingARRSummary";
import { PendingCollectionsTable } from "@/components/data-inputs/PendingCollectionsTable";
import { CollectedDealsTable } from "@/components/data-inputs/CollectedDealsTable";
import { useDeals, DealWithParticipants, PROPOSAL_TYPES } from "@/hooks/useDeals";
import { useClosingARRData, ClosingARRActual } from "@/hooks/useClosingARR";
import { usePendingCollections, useCollectedDeals } from "@/hooks/useCollections";
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
  const [selectedProposalType, setSelectedProposalType] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<"deals" | "closing-arr" | "collections">("deals");
  const [collectionsSubTab, setCollectionsSubTab] = useState<"pending" | "collected">("pending");
  
  // Deals state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithParticipants | null>(null);

  // Closing ARR state
  const [arrDialogOpen, setArrDialogOpen] = useState(false);
  const [arrBulkUploadOpen, setArrBulkUploadOpen] = useState(false);
  const [editingARR, setEditingARR] = useState<ClosingARRActual | null>(null);

  // Fetch deals based on filters
  const { data: deals = [], isLoading: isLoadingDeals } = useDeals(
    selectedMonth,
    selectedProposalType === "all" ? undefined : selectedProposalType
  );

  // Fetch Closing ARR data
  const { data: closingARRRecords = [], isLoading: isLoadingARR } = useClosingARRData(selectedMonth);

  // Fetch Collections data
  const { data: pendingCollections = [], isLoading: isLoadingPending } = usePendingCollections();
  const { data: collectedDeals = [], isLoading: isLoadingCollected } = useCollectedDeals();

  const handleAddDeal = () => {
    setEditingDeal(null);
    setDialogOpen(true);
  };

  const handleEditDeal = (deal: DealWithParticipants) => {
    setEditingDeal(deal);
    setDialogOpen(true);
  };

  const handleAddARR = () => {
    setEditingARR(null);
    setArrDialogOpen(true);
  };

  const handleEditARR = (record: ClosingARRActual) => {
    setEditingARR(record);
    setArrDialogOpen(true);
  };

  // Calculate deals stats
  const totalDeals = deals.length;
  const totalARR = deals.reduce((sum, d) => sum + (d.new_software_booking_arr_usd || 0), 0);
  const totalTCV = deals.reduce((sum, d) => sum + (d.tcv_usd || 0), 0);
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

  // Filter deals by proposal type for tabs
  const getDealsForType = (proposalType: string) => {
    if (proposalType === "all") return deals;
    return deals.filter((d) => d.type_of_proposal === proposalType);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Data Inputs</h1>
            <p className="text-muted-foreground">Manage deal-level actuals and Closing ARR data</p>
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
          </div>
        </div>

        {/* Section Tabs */}
        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "deals" | "closing-arr" | "collections")}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Deals
            </TabsTrigger>
            <TabsTrigger value="closing-arr" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Closing ARR
            </TabsTrigger>
            <TabsTrigger value="collections" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Collections
              {pendingCollections.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {pendingCollections.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Deals Section */}
          <TabsContent value="deals" className="space-y-6 mt-6">
            {/* Deals Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Bulk Upload
              </Button>
              <Button onClick={handleAddDeal}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Deal
              </Button>
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
                    <p className="text-sm text-muted-foreground">Total ARR (USD)</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {formatCurrency(totalARR)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      TCV: {formatCurrency(totalTCV)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Deals Table with Proposal Type Tabs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deals by Proposal Type</CardTitle>
                <CardDescription>
                  View and manage deals categorized by type of proposal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedProposalType} onValueChange={setSelectedProposalType}>
                  <TabsList className="mb-4 flex-wrap h-auto gap-1">
                    <TabsTrigger value="all" className="text-xs">
                      All
                      <Badge variant="secondary" className="ml-1.5 text-xs">
                        {deals.length}
                      </Badge>
                    </TabsTrigger>
                    {PROPOSAL_TYPES.map((type) => {
                      const count = deals.filter((d) => d.type_of_proposal === type.value).length;
                      return (
                        <TabsTrigger key={type.value} value={type.value} className="text-xs">
                          {type.label}
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
                      isLoading={isLoadingDeals}
                    />
                  </TabsContent>

                  {PROPOSAL_TYPES.map((type) => (
                    <TabsContent key={type.value} value={type.value}>
                      <DealsTable
                        deals={getDealsForType(type.value)}
                        onEdit={handleEditDeal}
                        isLoading={isLoadingDeals}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Closing ARR Section */}
          <TabsContent value="closing-arr" className="space-y-6 mt-6">
            {/* Closing ARR Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setArrBulkUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Bulk Upload
              </Button>
              <Button onClick={handleAddARR}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Record
              </Button>
            </div>

            {/* Closing ARR Summary */}
            <ClosingARRSummary records={closingARRRecords} fiscalYear={selectedYear} />

            {/* Closing ARR Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Closing ARR Data</CardTitle>
                <CardDescription>
                  Monthly project-level ARR snapshot. Eligible projects (end date &gt; Dec 31, {selectedYear}) count toward achievement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClosingARRTable
                  records={closingARRRecords}
                  onEdit={handleEditARR}
                  isLoading={isLoadingARR}
                  fiscalYear={selectedYear}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collections Section */}
          <TabsContent value="collections" className="space-y-6 mt-6">
            {/* Collections Sub-Tabs */}
            <Tabs value={collectionsSubTab} onValueChange={(v) => setCollectionsSubTab(v as "pending" | "collected")}>
              <TabsList>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Collections
                  {pendingCollections.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {pendingCollections.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="collected" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Collected Deals
                  {collectedDeals.length > 0 && (
                    <Badge variant="outline" className="ml-1">
                      {collectedDeals.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pending Collections</CardTitle>
                    <CardDescription>
                      Cumulative view of all deals awaiting collection. Mark as "Yes" when payment is received.
                      Deals are automatically added here when created in the Deals tab.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PendingCollectionsTable
                      collections={pendingCollections}
                      isLoading={isLoadingPending}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="collected" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Collected Deals Report</CardTitle>
                    <CardDescription>
                      Historical view of all collected deals for payroll processing. 
                      Filter by collection month to see deals processed in that period.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CollectedDealsTable
                      collections={collectedDeals}
                      isLoading={isLoadingCollected}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Deal Form Dialog */}
        <DealFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          deal={editingDeal}
          defaultMonth={selectedMonth}
          defaultProposalType={selectedProposalType === "all" ? undefined : selectedProposalType}
        />

        {/* Deals Bulk Upload Dialog */}
        <DealsBulkUpload
          open={bulkUploadOpen}
          onOpenChange={setBulkUploadOpen}
        />

        {/* Closing ARR Form Dialog */}
        <ClosingARRFormDialog
          open={arrDialogOpen}
          onOpenChange={setArrDialogOpen}
          record={editingARR}
          defaultMonth={selectedMonth}
        />

        {/* Closing ARR Bulk Upload Dialog */}
        <ClosingARRBulkUpload
          open={arrBulkUploadOpen}
          onOpenChange={setArrBulkUploadOpen}
        />
      </div>
    </AppLayout>
  );
}
