import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileSpreadsheet, CheckCircle, AlertCircle, DollarSign, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingsTab } from "@/components/data-inputs/BookingsTab";
import { QuarterlyTargetsTab } from "@/components/data-inputs/QuarterlyTargetsTab";
import { ClosingArrTab } from "@/components/data-inputs/ClosingArrTab";
import { ExchangeRatesTab } from "@/components/data-inputs/ExchangeRatesTab";
import { PayoutsTab } from "@/components/data-inputs/PayoutsTab";
import { useMonthlyBookings } from "@/hooks/useMonthlyBookings";
import { useMonthlyPayouts } from "@/hooks/useMonthlyPayouts";
import { format, subMonths } from "date-fns";

// Generate last 12 months for selection
const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subMonths(today, i);
    const value = format(date, "yyyy-MM-01");
    const label = format(date, "MMMM yyyy");
    options.push({ value, label });
  }
  return options;
};

const monthOptions = generateMonthOptions();

export default function DataInputs() {
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [activeTab, setActiveTab] = useState("bookings");

  const { data: bookings } = useMonthlyBookings(selectedMonth);
  const { data: payouts } = useMonthlyPayouts(selectedMonth);

  const totalBookings = bookings?.length || 0;
  const pendingBookings = bookings?.filter((b) => b.status === "pending").length || 0;
  const totalPayouts = payouts?.reduce((sum, p) => sum + p.calculated_amount_usd, 0) || 0;

  // Get quarter and fiscal year info
  const selectedDate = new Date(selectedMonth);
  const quarter = Math.ceil((selectedDate.getMonth() + 1) / 3);
  const fiscalYear = selectedDate.getFullYear();

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Data Inputs</h1>
            <p className="text-muted-foreground">
              Upload and manage performance data, targets, and payouts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
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

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-semibold text-foreground">{totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-semibold text-foreground">{pendingBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="text-2xl font-semibold text-foreground">
                    ${totalPayouts.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Selected Period</p>
                <p className="text-lg font-semibold text-foreground">
                  {format(selectedDate, "MMMM yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">FY {fiscalYear} Q{quarter}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-4">
              <TabsList className="h-12 bg-transparent">
                <TabsTrigger value="bookings" className="data-[state=active]:bg-muted">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Bookings
                </TabsTrigger>
                <TabsTrigger value="quarterly" className="data-[state=active]:bg-muted">
                  <Target className="h-4 w-4 mr-2" />
                  Quarterly Targets
                </TabsTrigger>
                <TabsTrigger value="closing-arr" className="data-[state=active]:bg-muted">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Closing ARR
                </TabsTrigger>
                <TabsTrigger value="payouts" className="data-[state=active]:bg-muted">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="exchange-rates" className="data-[state=active]:bg-muted">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Exchange Rates
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="bookings" className="mt-0">
                <BookingsTab selectedMonth={selectedMonth} />
              </TabsContent>

              <TabsContent value="quarterly" className="mt-0">
                <div className="mb-4">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <QuarterlyTargetsTab selectedYear={selectedYear} />
              </TabsContent>

              <TabsContent value="closing-arr" className="mt-0">
                <div className="mb-4">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ClosingArrTab selectedYear={selectedYear} />
              </TabsContent>

              <TabsContent value="payouts" className="mt-0">
                <PayoutsTab selectedMonth={selectedMonth} />
              </TabsContent>

              <TabsContent value="exchange-rates" className="mt-0">
                <ExchangeRatesTab selectedMonth={selectedMonth} />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}
