'use client';

import { ArrowUpRight, CircleAlert, Lightbulb, NotebookPen, TrendingUp, Wheat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CropLabel } from '@/components/ui/crop-icon';
import { yieldInsight } from '@/lib/calculations/yield';
import { formatGHS, todayISO } from '@/lib/format';
import { useModalStore } from '@/store/modal-store';
import type { YieldInput, YieldResult as Prediction } from '@/types';

const quantity = (value: number) => value.toLocaleString('en-GH', { maximumFractionDigits: 2 });

export function YieldResult({
  input,
  result,
  stale = false,
}: {
  input: YieldInput;
  result: Prediction;
  stale?: boolean;
}) {
  const openRecord = useModalStore((state) => state.openRecordWithDefaults);
  return (
    <Card className="rounded-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text flex items-center gap-2 text-[15px] font-bold">
          <TrendingUp size={17} aria-hidden="true" className="text-ink-green" />
          Your harvest outlook
        </h3>
        <Badge color="purple">Model estimate</Badge>
      </div>
      {stale && (
        <p
          role="status"
          className="bg-gold/10 text-ink-gold mb-4 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed"
        >
          <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          Inputs have changed. Predict again to update this estimate.
        </p>
      )}
      <div className="border-accent/25 from-accent/15 via-accent/5 relative overflow-hidden rounded-2xl border bg-linear-to-br to-transparent p-5 sm:p-6">
        <Wheat
          size={110}
          strokeWidth={1}
          aria-hidden="true"
          className="text-accent/10 absolute -right-5 -bottom-4 -rotate-12"
        />
        <div className="relative">
          <p className="text-ink-green text-[11px] font-semibold tracking-wider uppercase">
            Predicted Yield
          </p>
          <p className="text-text mt-3 text-3xl leading-tight font-extrabold tracking-tight tabular-nums">
            {quantity(result.low)} – {quantity(result.high)}{' '}
            <span className="text-text-dim text-base font-medium">tonnes</span>
          </p>
          <p className="text-text mt-2 text-sm font-semibold">
            Expected: {quantity(result.expected)} t
          </p>
          <p className="text-text-mute mt-2 text-xs">
            {quantity(result.perAcre)} t/acre × {quantity(input.acres)}{' '}
            {input.acres === 1 ? 'acre' : 'acres'}
          </p>
          <div className="text-text-dim mt-5 flex flex-wrap items-center gap-2 text-xs">
            <CropLabel crop={input.crop} />
            <span aria-hidden="true">·</span>
            <span>{input.season === 'major' ? 'Major season' : 'Minor season'}</span>
          </div>
        </div>
      </div>
      <div className="glass mt-4 rounded-2xl p-4">
        <p className="text-text-mute text-[10px] font-semibold tracking-wider uppercase">
          Your revenue potential
        </p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-text-dim">Expected Revenue</dt>
            <dd className="text-ink-green flex items-center gap-1 text-lg font-bold tabular-nums">
              {formatGHS(result.revenue)}
              <ArrowUpRight size={16} aria-hidden="true" />
            </dd>
          </div>
          <div className="border-border flex flex-wrap justify-between gap-2 border-t pt-3 text-xs">
            <dt className="text-text-mute">Market Price</dt>
            <dd className="text-text font-semibold">{formatGHS(result.pricePerTonne)}/tonne</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <dt className="text-text-mute">Revenue Range</dt>
            <dd className="text-text font-semibold">
              {formatGHS(result.low * result.pricePerTonne)} –{' '}
              {formatGHS(result.high * result.pricePerTonne)}
            </dd>
          </div>
        </dl>
        <p className="text-text-mute mt-3 text-[10px]">
          Indicative prices from the app’s sample data.
        </p>
      </div>
      <div className="bg-info/5 text-text-dim mt-4 flex gap-2.5 rounded-xl p-3 text-xs leading-relaxed">
        <Lightbulb size={16} aria-hidden="true" className="text-ink-blue mt-0.5 shrink-0" />
        <p>{yieldInsight(input, result)}</p>
      </div>
      <Button
        variant="ghost"
        icon={NotebookPen}
        className="mt-5 w-full whitespace-normal"
        disabled={stale}
        onClick={() =>
          openRecord({
            type: 'income',
            crop: input.crop,
            amount: result.revenue,
            description: 'Expected harvest (prediction)',
            date: todayISO(),
            notes: `Planning estimate only, not a completed sale. Predicted ${quantity(result.expected)} tonnes from ${quantity(input.acres)} acres. Replace with actual harvest income when known.`,
          })
        }
      >
        Add to records as expected income
      </Button>
      <p className="text-text-mute mt-2 text-center text-[10px] leading-relaxed">
        Review before saving. Expected income is a planning estimate.
      </p>
    </Card>
  );
}
