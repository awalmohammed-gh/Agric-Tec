import { Lightbulb } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CropTile } from '@/components/ui/crop-icon';
import { BASE_YIELD_PER_ACRE, CROP_TIPS, PRICE_PER_TONNE } from '@/constants/crops';
import { formatGHS } from '@/lib/format';
import type { Crop } from '@/types';

export function YieldTips({ crop }: { crop: Exclude<Crop, 'Other'> }) {
  const facts = [
    { label: 'Average yield', value: `${BASE_YIELD_PER_ACRE[crop]} t/acre` },
    { label: 'Farm-gate price', value: `${formatGHS(PRICE_PER_TONNE[crop])}/t` },
    {
      label: 'Average revenue',
      value: `${formatGHS(BASE_YIELD_PER_ACRE[crop] * PRICE_PER_TONNE[crop])}/acre`,
    },
  ];

  return (
    <Card className="@container rounded-3xl">
      <div className="flex flex-col gap-5 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <div className="flex items-center gap-3">
          <CropTile crop={crop} />
          <div>
            <h3 className="text-text flex items-center gap-2 text-[15px] font-bold">
              Yield Optimization Tips for {crop}
              <Lightbulb size={16} aria-hidden="true" className="text-ink-gold" />
            </h3>
            <p className="text-text-mute mt-0.5 text-xs">
              Small steps for a stronger growing season
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 @3xl:min-w-96">
          {facts.map((fact) => (
            <div key={fact.label} className="border-border bg-glass rounded-xl border px-3 py-2">
              <dt className="text-text-mute text-[10px] font-semibold tracking-wide uppercase">
                {fact.label}
              </dt>
              <dd className="text-text mt-0.5 text-xs font-bold tabular-nums @md:text-sm">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ol className="mt-5 grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-4">
        {CROP_TIPS[crop].map((tip, index) => (
          <li
            key={tip}
            className="border-border bg-bg-2/40 hover:border-accent/30 relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition-colors"
          >
            <span
              aria-hidden="true"
              className="text-accent/10 font-display pointer-events-none absolute -top-3 -right-1 text-6xl font-extrabold"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-ink-green bg-accent/10 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
              Step {index + 1}
            </span>
            <p className="text-text-dim relative text-sm leading-relaxed">{tip}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
