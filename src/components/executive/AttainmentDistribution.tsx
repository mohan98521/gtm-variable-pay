import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AttainmentBucket } from "@/hooks/useExecutiveDashboard";

interface AttainmentDistributionProps {
  data: AttainmentBucket[];
  isLoading: boolean;
}

export function AttainmentDistribution({ data, isLoading }: AttainmentDistributionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Attainment Distribution</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">Attainment Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} reps`, "Count"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={36}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
