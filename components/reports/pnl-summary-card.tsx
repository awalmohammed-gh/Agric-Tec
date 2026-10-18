'use client';

import { ArrowDownRight, ArrowUpRight, Percent, Scale, type LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';

function Row({
  icon: Icon,
  tone,
  label,
  value,
  valueClass,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <dt className="text-text-dim flex-1 text-sm">{label}</dt>
      <dd className={cn('text-lg font-extrabold tracking-tight tabular-nums', valueClass)}>
        {value}
      </dd>
    </div>
  );
}

/** Profit & loss at a glance, plus how much of every cedi earned goes to costs. */
export function PnlSummaryCard() {
  const { income, expenses, profit, margin } = useFarmStats();
  const costShare = income > 0 ? Math.min(100, Math.round((expenses / income) * 100)) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Profit &amp; Loss</CardTitle>
          <CardSub>All recorded income and expenses</CardSub>
        </div>
      </CardHeader>

      <dl className="divide-border divide-y">
        <Row
          icon={ArrowUpRight}
          tone="bg-accent/15 text-ink-green"
          label="Total Income"
          value={formatGHS(income)}
          valueClass="text-ink-green"
        />
        <Row
          icon={ArrowDownRight}
          tone="bg-danger/15 text-ink-red"
          label="Total Expenses"
          value={formatGHS(expenses)}
          valueClass="text-ink-red"
        />
        <Row
          icon={Scale}
          tone="bg-purple/15 text-ink-purple"
          label="Net Profit"
          value={formatGHS(profit)}
          valueClass={profit >= 0 ? 'text-ink-green' : 'text-ink-red'}
        />
        <Row
          icon={Percent}
          tone="bg-gold/15 text-ink-gold"
          label="Profit Margin"
          value={`${margin}%`}
          valueClass="text-text"
        />
      </dl>

      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-text-dim">Costs per GHS 1 earned</span>
          <span className="text-text font-semibold">
            {income > 0 ? `GHS ${(expenses / income).toFixed(2)}` : 'No income yet'}
          </span>
        </div>
        {/* With no income there is nothing to split, so show an empty track (not "kept 100%"). */}
        <div
          className="bg-glass-strong flex h-2.5 overflow-hidden rounded-full"
          role="img"
          aria-label={
            income > 0 ? `Expenses are ${costShare}% of income` : 'No income recorded yet'
          }
        >
          {income > 0 && (
            <>
              <div
                className="animate-progress-grow h-full bg-linear-to-r from-[#f87171] to-[#ef4444]"
                style={{ width: `${costShare}%` }}
              />
              <div className="h-full flex-1 bg-linear-to-r from-[#10b981] to-[#34d399]" />
            </>
          )}
        </div>
        {income > 0 && (
          <div className="text-text-mute mt-1.5 flex justify-between text-[11px]">
            <span>Costs {costShare}%</span>
            <span>Kept {100 - costShare}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}
