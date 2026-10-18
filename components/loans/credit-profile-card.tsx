'use client';

import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { FACTORS, SCORE_RANGE, ScoreFactors } from '@/components/loans/score-factors';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { cn } from '@/lib/utils';

const LABEL_COLOR: Record<string, BadgeColor> = {
  Building: 'red',
  Fair: 'gold',
  Good: 'green',
  Excellent: 'purple',
};

/** Where to send the farmer to improve each factor. */
const FACTOR_LINKS: Record<string, string> = {
  paymentHistory: '/records',
  recordCompleteness: '/records',
  incomeStability: '/records',
  momoActivity: '/momo',
  verification: '/settings/verification',
};

/**
 * The factors behind the score (the same calculateCreditScore result as the dashboard),
 * plus the single change that would add the most points.
 */
export function CreditProfileCard({ className }: { className?: string }) {
  const { credit, creditLabel } = useFarmStats();

  const opportunities = FACTORS.map((factor) => {
    const max = Math.round((factor.weight / 100) * SCORE_RANGE);
    const earned = Math.round((credit[factor.key] / 100) * max);
    return { ...factor, available: max - earned };
  }).sort((a, b) => b.available - a.available);
  const top = opportunities[0];

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>Credit Profile</CardTitle>
          <CardSub>What makes up your score</CardSub>
        </div>
        <Badge color={LABEL_COLOR[creditLabel] ?? 'blue'}>{creditLabel}</Badge>
      </CardHeader>

      <div className="mb-5 flex items-end gap-2">
        <span className="text-text text-4xl leading-none font-extrabold tracking-tight">
          {credit.score}
        </span>
        <span className="text-text-mute pb-1 text-sm">/ 850 credit score</span>
      </div>

      <ScoreFactors />

      {top && top.available > 0 && (
        <div className="border-gold/30 bg-gold/10 mt-5 rounded-2xl border p-4">
          <p className="text-ink-gold flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Target size={14} aria-hidden="true" /> Biggest opportunity
          </p>
          <p className="text-text mt-1 text-sm">
            <strong>{top.label}</strong> has up to <strong>+{top.available} points</strong> waiting.{' '}
            {top.help}.
          </p>
          <Link
            href={FACTOR_LINKS[top.key]}
            className="group text-ink-green mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold"
          >
            Improve {top.label.toLowerCase()}
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      )}
    </Card>
  );
}
