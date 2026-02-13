import { Users, Target, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { TeamCompensationResult } from "@/hooks/useTeamCompensation";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatCurrencyValue } from "@/lib/utils";

const formatCurrency = (value: number) => formatCurrencyValue(value);

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
        <MetricCard
          key={card.label}
          title={card.label}
          value={card.value}
          subtitle={card.sub}
          icon={<card.icon className="h-5 w-5" />}
        />
      ))}
    </div>
  );
}
