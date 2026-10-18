'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, History, Sprout, type LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFarmStore } from '@/store/farm-store';
import type { FarmRecord, MomoTransaction } from '@/types';

const MAX_ITEMS = 6;

type Tone = 'in' | 'out' | 'activity';

interface ActivityItem {
  id: string;
  label: string;
  date: string;
  createdAt: string;
  tone: Tone;
  amount: number | null; // null = activity, shown without an amount
}

const TONES: Record<Tone, { icon: LucideIcon; tile: string; text: string }> = {
  in: { icon: ArrowUpRight, tile: 'bg-accent/15 text-ink-green', text: 'text-ink-green' },
  out: { icon: ArrowDownLeft, tile: 'bg-danger/15 text-ink-red', text: 'text-ink-red' },
  activity: { icon: Sprout, tile: 'bg-info/15 text-ink-blue', text: '' },
};

function combine(records: FarmRecord[], momo: MomoTransaction[]): ActivityItem[] {
  const fromRecords = records.map<ActivityItem>((r) => ({
    id: r.id,
    label: r.description,
    date: r.date,
    createdAt: r.createdAt,
    tone: r.type === 'income' ? 'in' : r.type === 'expense' ? 'out' : 'activity',
    amount: r.type === 'activity' ? null : r.amount,
  }));
  const fromMomo = momo.map<ActivityItem>((t) => ({
    id: t.id,
    label: `MoMo · ${t.counterparty}`,
    date: t.date,
    createdAt: t.createdAt,
    tone: t.direction === 'in' ? 'in' : 'out',
    amount: t.amount,
  }));
  return [...fromRecords, ...fromMomo]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ITEMS);
}

export function RecentActivity() {
  const records = useFarmStore((s) => s.records);
  const momo = useFarmStore((s) => s.momo);
  const items = combine(records, momo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <Link
          href="/records"
          className="text-ink-green -my-2 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
        >
          View all →
        </Link>
      </CardHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Your latest records and MoMo transactions will show up here."
        />
      ) : (
        <ul className="divide-border divide-y">
          {items.map((item) => {
            const tone = TONES[item.tone];
            const Icon = tone.icon;
            return (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-xl',
                    tone.tile,
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-text truncate text-sm font-medium">{item.label}</p>
                  <p className="text-text-mute text-xs">{formatDate(item.date)}</p>
                </div>
                {item.amount !== null && (
                  <span className={cn('shrink-0 text-sm font-semibold', tone.text)}>
                    {item.tone === 'in' ? '+' : '−'}
                    {formatGHS(item.amount)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
