import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { DealCollectionStatus } from "@/hooks/useCurrentUserCompensation";
import { formatCurrencyValue } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface CollectionStatusCardProps {
  dealCollections: DealCollectionStatus[];
}

function getStatusBadge(item: DealCollectionStatus) {
  if (item.isClawbackTriggered) {
    return <Badge variant="destructive" className="text-xs">Clawback</Badge>;
  }
  if (item.isCollected) {
    return <Badge className="bg-success text-success-foreground text-xs">Collected</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">Pending</Badge>;
}

export function CollectionStatusCard({ dealCollections }: CollectionStatusCardProps) {
  const fmt = (v: number) => formatCurrencyValue(v);
  const collected = dealCollections.filter(d => d.isCollected && !d.isClawbackTriggered).length;
  const pending = dealCollections.filter(d => !d.isCollected && !d.isClawbackTriggered).length;
  const clawback = dealCollections.filter(d => d.isClawbackTriggered).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Deal Collection Status
          <div className="ml-auto flex gap-2">
            <Badge className="bg-success text-success-foreground text-xs">{collected} Collected</Badge>
            <Badge variant="secondary" className="text-xs">{pending} Pending</Badge>
            {clawback > 0 && (
              <Badge variant="destructive" className="text-xs">{clawback} Clawback</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Project ID</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-right">Deal Value</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">Collection Date</TableHead>
                <TableHead className="text-xs">Booking Month</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealCollections.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">{d.projectId}</TableCell>
                  <TableCell className="text-xs">{d.customerName || "—"}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(d.dealValueUsd)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(d)}</TableCell>
                  <TableCell className="text-xs">
                    {d.collectionDate ? format(parseISO(d.collectionDate), "MMM dd, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.bookingMonth ? format(parseISO(d.bookingMonth), "MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {dealCollections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                    No deal collections found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
