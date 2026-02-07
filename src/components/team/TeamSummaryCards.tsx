import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { TeamCompensationResult } from "@/hooks/useTeamCompensation";

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};

interface TeamSummaryCardsProps {
  data: TeamCompensationResult;
}

export function TeamSummaryCards({ data }: TeamSummaryCardsProps) {
  const cards = [
    {
      icon: Users,
      label: "Team Members",
      value: String(data.teamMemberCount),
      sub: "Active direct reports",
    },
    {
      icon: Target,
      label: "Team Target (TVP)",
      value: formatCurrency(data.teamTotalTvp),
      sub: "Total variable pay target",
    },
    {
      icon: TrendingUp,
      label: "Team Achievement",
      value: `${data.teamWeightedAchievement.toFixed(1)}%`,
      sub: "Weighted average",
    },
    {
      icon: DollarSign,
      label: "Total Eligible Payout",
      value: formatCurrency(data.teamTotalEligible),
      sub: "Variable pay + commissions",
    },
    {
      icon: Wallet,
      label: "Total Paid",
      value: formatCurrency(data.teamTotalPaid),
      sub: "Booking split paid",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <p className="text-xl font-semibold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
