'use client';

import { ArrowDownLeft, ArrowUpRight, Hash, Scale } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';

export function MomoStats() {
  const { momo } = useFarmStats();

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <StatCard
        icon={ArrowDownLeft}
        color="green"
        label="MoMo Inflows"
        value={formatGHS(momo.inflow)}
      />
      <StatCard
        icon={ArrowUpRight}
        color="blue"
        label="MoMo Outflows"
        value={formatGHS(momo.outflow)}
      />
      <StatCard
        icon={Scale}
        color="purple"
        label="Net Balance"
        value={
          <span className={momo.net < 0 ? 'text-ink-red' : undefined}>{formatGHS(momo.net)}</span>
        }
      />
      <StatCard icon={Hash} color="gold" label="Total Transactions" value={momo.count} />
    </div>
  );
}
