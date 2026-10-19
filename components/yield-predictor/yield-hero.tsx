'use client';

import {
  Banknote,
  ChartNoAxesCombined,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import { CropIcon, cropFromName } from '@/components/ui/crop-icon';
import { boostPercent, inputStrength } from '@/components/yield-predictor/yield-options';
import { useProfileStore } from '@/store/profile-store';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sprout, title: 'Choose', text: 'Your crop and acreage' },
  { icon: SlidersHorizontal, title: 'Tune', text: 'Season, fertilizer, water' },
  { icon: Banknote, title: 'Plan', text: 'Harvest and revenue range' },
];

const BEST_BOOST = boostPercent(
  inputStrength({ season: 'major', fertilizer: 'both', irrigation: 'drip' }).current,
);

const BARS = [34, 48, 42, 63, 58, 80, 96];

/** Decorative growth chart: rising bars with a forecast band and floating result chips. */
function GrowthVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-56 w-64">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,rgba(245,196,81,0.22),transparent_70%)]" />
      <div className="border-border bg-bg-2/70 absolute inset-x-4 inset-y-5 overflow-hidden rounded-3xl border p-4">
        <div className="flex h-full items-end gap-1.5">
          {BARS.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={
                i >= BARS.length - 2
                  ? 'flex-1 rounded-t-md border border-dashed border-[#f5c451] bg-[#f5c451]/25'
                  : 'flex-1 rounded-t-md bg-linear-to-t from-[#10b981] to-[#34d399]'
              }
            />
          ))}
        </div>
        <ChartNoAxesCombined
          size={18}
          className="text-text-mute absolute top-3 left-3 opacity-70"
        />
      </div>
      <span className="border-gold/40 bg-bg-2 text-ink-gold absolute top-2 -right-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-lg">
        Forecast
      </span>
      <span className="border-accent/40 bg-bg-2 text-ink-green absolute bottom-10 -left-4 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-lg">
        +{BEST_BOOST}% with best inputs
      </span>
    </div>
  );
}

export function YieldHero() {
  const profile = useProfileStore((s) => s.profile);
  const mainCrop = profile?.primaryCrops[0];

  const stats = [
    {
      label: 'Farm size',
      value: profile && profile.acres > 0 ? `${profile.acres} acres` : 'Not set',
    },
    { label: 'Main crop', value: mainCrop ?? 'Not set' },
    { label: 'Region', value: profile?.region || 'Not set' },
  ];

  return (
    <section
      aria-labelledby="yield-title"
      className="border-border bg-glass shadow-glass @container relative overflow-hidden rounded-3xl border p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_70%)]"
      />
      <div className="relative grid items-center gap-8 @3xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <span className="border-gold/30 bg-gold/10 text-ink-gold inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
            <Sparkles size={13} aria-hidden="true" /> AI Yield Predictor
          </span>
          <h2
            id="yield-title"
            className="font-display text-text mt-4 text-3xl leading-tight font-bold @xl:text-4xl"
          >
            Know your harvest <span className="text-gradient-brand">before you plant</span>
          </h2>
          <p className="text-text-dim mt-3 max-w-xl text-sm @xl:text-base">
            Estimate how many tonnes your farm could produce this season, what it could earn, and
            which inputs would raise it most.
          </p>

          <ol className="mt-6 grid grid-cols-1 gap-3 @md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className="border-border bg-glass flex items-center gap-3 rounded-2xl border px-3.5 py-3"
              >
                <span className="bg-accent/15 text-ink-green relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon size={18} aria-hidden="true" />
                  <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#10b981] text-[10px] font-bold text-[#022c22]">
                    {i + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="text-text block text-sm font-bold">{title}</span>
                  <span className="text-text-mute block text-xs">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-text-mute text-[11px]">{s.label}</dt>
                <dd className="text-text flex items-center gap-1.5 text-sm font-bold">
                  {s.label === 'Main crop' && mainCrop && (
                    <CropIcon crop={cropFromName(mainCrop)} size={14} className="text-ink-green" />
                  )}
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-text-mute mt-5 inline-flex items-center gap-1.5 text-xs">
            <ShieldCheck size={12} aria-hidden="true" /> A planning estimate from average Ghana
            yields. Real harvests depend on weather, pests and soil.
          </p>
        </div>

        <div className="hidden @3xl:block">
          <GrowthVisual />
        </div>
      </div>
    </section>
  );
}
