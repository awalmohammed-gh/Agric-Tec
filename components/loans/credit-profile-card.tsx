'use client';

import { ScoreFactors } from '@/components/loans/score-factors';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { cn } from '@/lib/utils';

const MIN = 300;
const MAX = 850;
const pos = (score: number) => ((score - MIN) / (MAX - MIN)) * 100;

const LABEL_COLOR: Record<string, BadgeColor> = {
  Building: 'red',
  Fair: 'gold',
  Good: 'green',
  Excellent: 'purple',
};

const BANDS = [
  { label: 'Building', from: 300 },
  { label: 'Fair', from: 500 },
  { label: 'Good', from: 650 },
  { label: 'Excellent', from: 750 },
];

/**
 * Credit score (the same calculateCreditScore result as the dashboard), a 300–850 scale with
 * a marker, and the five factors.
 */
export function CreditProfileCard({ className }: { className?: string }) {
  const { credit, creditLabel } = useFarmStats();
  const marker = Math.min(100, Math.max(0, pos(credit.score)));

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>Credit Profile</CardTitle>
          <CardSub>Your AgriCtec credit score</CardSub>
        </div>
        <Badge color={LABEL_COLOR[creditLabel] ?? 'blue'}>{creditLabel}</Badge>
      </CardHeader>

      <div className="flex flex-col items-center">
        <ScoreRing value={credit.score} max={MAX} label="Credit score" size={156} />
        <p className="text-text-mute mt-3 text-xs">Scores range from 300 to 850</p>
      </div>

      {/* 300–850 scale with the farmer's position */}
      <div className="mt-5" aria-hidden="true">
        <div className="relative h-2.5 rounded-full bg-linear-to-r from-[#ef4444] via-[#f5c451] to-[#10b981]">
          <span
            className="border-bg-1 absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white shadow"
            style={{ left: `${marker}%` }}
          />
        </div>
        <div className="text-text-mute relative mt-2 h-4 text-[10px]">
          {BANDS.map((band) => (
            <span
              key={band.label}
              className={cn(
                'absolute -translate-x-0',
                band.label === creditLabel && 'text-text font-semibold',
              )}
              style={{ left: `${pos(band.from)}%` }}
            >
              {band.label}
            </span>
          ))}
        </div>
      </div>

      <div className="border-border mt-6 border-t pt-5">
        <p className="text-text-mute mb-4 text-[11px] font-semibold tracking-wider uppercase">
          What makes up your score
        </p>
        <ScoreFactors />
      </div>
    </Card>
  );
}
