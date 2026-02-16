import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { MonthlyTrend } from "@/hooks/useExecutiveDashboard";

interface PayoutTrendChartProps {
  data: MonthlyTrend[];
  isLoading: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function PayoutTrendChart({ data, isLoading }: PayoutTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Payout & Attainment Trend</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">Payout & Attainment Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCompact}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              domain={[0, 150]}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "avgAttainment" ? `${value.toFixed(1)}%` : formatCompact(value)
              }
              labelStyle={{ color: "hsl(var(--foreground))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === "totalPayout") return "Monthly Eligible Payout";
                if (value === "cumulativePayout") return "Cumulative YTD";
                return "Avg Attainment %";
              }}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar yAxisId="left" dataKey="totalPayout" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={28} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cumulativePayout"
              stroke="hsl(38 92% 50%)"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: "hsl(38 92% 50%)" }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgAttainment"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--accent))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
