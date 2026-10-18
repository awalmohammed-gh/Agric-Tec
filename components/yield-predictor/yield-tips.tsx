import { Lightbulb } from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { CropTile } from '@/components/ui/crop-icon';
import { CROP_TIPS } from '@/constants/crops';
import type { Crop } from '@/types';

export function YieldTips({ crop }: { crop: Exclude<Crop, 'Other'> }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CropTile crop={crop} />
          <div>
            <CardTitle>Yield Optimization Tips for {crop}</CardTitle>
            <CardSub>Small steps for a stronger growing season</CardSub>
          </div>
        </div>
        <Lightbulb
          size={19}
          aria-hidden="true"
          className="text-ink-gold hidden shrink-0 sm:block"
        />
      </CardHeader>
      <ul className="grid gap-3 @2xl:grid-cols-2">
        {CROP_TIPS[crop].map((tip, index) => (
          <li
            key={tip}
            className="border-border bg-bg-2/40 flex items-start gap-3 rounded-2xl border p-4"
          >
            <span className="text-ink-green bg-accent/10 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="text-text-dim text-sm leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
