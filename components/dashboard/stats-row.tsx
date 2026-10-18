'use client';

import { Sprout, Star, TrendingDown, Wallet } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';

export function StatsRow() {
  const stats = useFarmStats();
  const expenseShare = stats.income > 0 ? Math.round((stats.expenses / stats.income) * 100) : null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <StatCard
        icon={Wallet}
        color="green"
        label="Total Income (YTD)"
        value={formatGHS(stats.ytdIncome)}
        change={
          stats.ytdIncome > 0
            ? { text: 'This year', trend: 'up' }
            : { text: 'Start recording', trend: 'up' }
        }
      />
      <StatCard
        icon={TrendingDown}
        color="blue"
        label="Total Expenses"
        value={formatGHS(stats.expenses)}
        change={
          expenseShare === null
            ? { text: stats.expenses > 0 ? 'No income yet' : 'No expenses yet', trend: 'up' }
            : {
                text: `${expenseShare}% of income`,
                // Green while costs stay at or below 80% of income.
                trend: expenseShare <= 80 ? 'up' : 'down',
              }
        }
      />
      <StatCard
        icon={Sprout}
        color="purple"
        label="Active Crops"
        value={stats.activeCrops}
        change={{
          text: stats.acres > 0 ? `Across ${stats.acres} acres` : 'Add your acreage in Profile',
          trend: 'up',
        }}
      />
      <StatCard
        icon={Star}
        color="gold"
        label="Credit Score"
        value={stats.credit.score}
        change={{ text: stats.creditLabel, trend: stats.credit.score >= 550 ? 'up' : 'down' }}
      />
    </div>
  );
}
