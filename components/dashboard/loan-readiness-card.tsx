'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { cn } from '@/lib/utils';

export function LoanReadinessCard() {
  const { credit, readiness } = useFarmStats();

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Loan Readiness</CardTitle>
          <CardSub>AI-computed eligibility</CardSub>
        </div>
      </CardHeader>

      <div className="mb-5 flex justify-center">
        <ScoreRing value={credit.score} max={850} label="Credit score" />
      </div>

      <ul className="space-y-3">
        {readiness.map((item) => (
          <li key={item.key} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border',
                item.done
                  ? 'border-transparent bg-linear-to-br from-[#10b981] to-[#34d399] text-[#022c22]'
                  : 'border-border bg-glass-strong',
              )}
            >
              {item.done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="text-text text-sm font-semibold">
                {item.label}
                <span className="sr-only">{item.done ? ' (done)' : ' (pending)'}</span>
              </p>
              <p className="text-text-mute text-xs">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/loans"
        className="text-ink-green mt-5 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
      >
        View credit details →
      </Link>
    </Card>
  );
}
