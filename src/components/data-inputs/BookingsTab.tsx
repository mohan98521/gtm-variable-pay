import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Save, Trash2, Plus, CheckCircle, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CsvUploadDialog } from "./CsvUploadDialog";
import { useMonthlyBookings, useInsertMonthlyBookings, useDeleteMonthlyBooking } from "@/hooks/useMonthlyBookings";
import { useEmployees } from "@/hooks/useEmployees";
import { format } from "date-fns";

interface BookingsTabProps {
  selectedMonth: string;
}

const BOOKING_TYPES = [
  "Software ARR",
  "MS/PS ARR",
  "Perpetual License",
  "Managed Services",
  "Premium Support",
];

export function BookingsTab({ selectedMonth }: BookingsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: bookings, isLoading } = useMonthlyBookings(selectedMonth);
  const { data: employees } = useEmployees();
  const insertMutation = useInsertMonthlyBookings();
  const deleteMutation = useDeleteMonthlyBooking();

  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) || []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "booked":
        return (
          <Badge className="bg-success/10 text-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Booked
          </Badge>
        );
      case "collected":
        return (
          <Badge className="bg-primary/10 text-primary">
            <CheckCircle className="h-3 w-3 mr-1" />
            Collected
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCsvUpload = async (data: Record<string, string>[]) => {
    const bookingsToInsert = data.map((row) => ({
      employee_id: row.employee_id,
      month_year: selectedMonth,
      booking_type: row.booking_type,
      booking_value_usd: parseFloat(row.booking_value_usd) || 0,
      booking_value_local: row.booking_value_local ? parseFloat(row.booking_value_local) : null,
      local_currency: row.local_currency || "USD",
      tcv_value_usd: row.tcv_value_usd ? parseFloat(row.tcv_value_usd) : null,
      deal_type: row.deal_type || null,
      deal_name: row.deal_name || null,
      client_name: row.client_name || null,
      first_year_amc_arr_usd: row.first_year_amc_arr_usd ? parseFloat(row.first_year_amc_arr_usd) : null,
      status: row.status || "booked",
    }));

    await insertMutation.mutateAsync(bookingsToInsert);
  };

  const validateRow = (row: Record<string, string>, index: number): string | null => {
    if (!row.employee_id) return "Employee ID is required";
    if (!row.booking_type) return "Booking type is required";
    if (!row.booking_value_usd || isNaN(parseFloat(row.booking_value_usd))) {
      return "Valid booking value (USD) is required";
    }
    if (!employeeMap.has(row.employee_id)) {
      return `Employee ID "${row.employee_id}" not found`;
    }
    return null;
  };

  const templateColumns = [
    "employee_id",
    "booking_type",
    "booking_value_usd",
    "booking_value_local",
    "local_currency",
    "tcv_value_usd",
    "deal_type",
    "deal_name",
    "client_name",
    "first_year_amc_arr_usd",
    "status",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Monthly Bookings</h3>
          <p className="text-sm text-muted-foreground">
            Software ARR, MS/PS ARR, and commission-eligible deals
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : bookings && bookings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value (USD)</TableHead>
                  <TableHead>Deal Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const employee = employeeMap.get(booking.employee_id);
                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee?.full_name || booking.employee_id}</p>
                          <p className="text-xs text-muted-foreground">{booking.employee_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{booking.booking_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${booking.booking_value_usd.toLocaleString()}
                      </TableCell>
                      <TableCell>{booking.deal_type || "-"}</TableCell>
                      <TableCell>{booking.client_name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(booking.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No bookings for this period</p>
              <p className="text-sm">Upload a CSV file to add bookings</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload Monthly Bookings"
        description="Upload a CSV file with booking data for the selected month"
        templateColumns={templateColumns}
        templateFilename={`bookings_template_${selectedMonth}.csv`}
        onUpload={handleCsvUpload}
        validateRow={validateRow}
      />
    </div>
  );
}
