'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import {
  Banknote,
  ChartNoAxesCombined,
  Gauge,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Wheat,
} from 'lucide-react';
import { toast } from 'sonner';
import { YieldResult } from '@/components/yield-predictor/yield-result';
import { YieldBoosts } from '@/components/yield-predictor/yield-boosts';
import {
  ACRE_PRESETS,
  boostPercent,
  FERTILIZER_OPTIONS,
  inputStrength,
  IRRIGATION_OPTIONS,
  SEASON_OPTIONS,
  type YieldOption,
} from '@/components/yield-predictor/yield-options';
import {
  YIELD_CROPS,
  yieldSchema,
  type YieldFormInput,
  type YieldFormValues,
} from '@/components/yield-predictor/yield-schema';
import { YieldTips } from '@/components/yield-predictor/yield-tips';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { CROP_TONES, CropIcon } from '@/components/ui/crop-icon';
import { fieldErrorId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { YIELD_MULTIPLIERS } from '@/constants/crops';
import { predictYield } from '@/lib/calculations/yield';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profile-store';
import type { YieldResult as Prediction } from '@/types';

interface Estimate {
  input: YieldFormValues;
  result: Prediction;
}

const legendClass = 'text-text-dim mb-2 text-xs font-semibold tracking-wide uppercase';
const activeClass = 'border-accent/50 bg-accent/15 text-ink-green';
const idleClass = 'border-border bg-glass text-text-dim hover:text-text hover:border-accent/30';

/** Radio cards for one input (season, fertilizer or irrigation), with the yield boost of each. */
function OptionCards<T extends string>({
  legend,
  options,
  selected,
  boosts,
  registration,
  columns,
  stacked = false,
}: {
  legend: string;
  options: YieldOption<T>[];
  selected: string | undefined;
  boosts: Record<T, number>;
  registration: UseFormRegisterReturn;
  columns: string;
  /** Icon and boost on top, text below: fits narrow three-column rows. */
  stacked?: boolean;
}) {
  return (
    <fieldset>
      <legend className={legendClass}>{legend}</legend>
      <div className={cn('grid gap-2', columns)}>
        {options.map(({ value, label, hint, icon: Icon }) => {
          const active = selected === value;
          const boost = boostPercent(boosts[value]);
          const icon = (
            <span
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-xl',
                active ? 'bg-accent/20' : 'bg-glass-strong',
              )}
            >
              <Icon size={16} aria-hidden="true" />
            </span>
          );
          const badge = (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                boost > 0 ? 'bg-accent/15 text-ink-green' : 'bg-glass-strong text-text-mute',
              )}
            >
              {boost > 0 ? `+${boost}%` : 'Base'}
            </span>
          );
          const text = (
            <span className="min-w-0 flex-1">
              <span className="text-text block text-sm font-semibold">{label}</span>
              <span className="text-text-mute block text-[11px] leading-snug">{hint}</span>
            </span>
          );
          return (
            <label key={value} className="relative">
              <input type="radio" value={value} className="peer sr-only" {...registration} />
              <span
                className={cn(
                  'peer-focus-visible:outline-accent flex h-full cursor-pointer gap-2.5 rounded-2xl border p-3 transition-colors peer-focus-visible:outline-2',
                  stacked ? 'flex-col' : 'items-start',
                  active ? activeClass : idleClass,
                )}
              >
                {stacked ? (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      {icon}
                      {badge}
                    </span>
                    {text}
                  </>
                ) : (
                  <>
                    {icon}
                    {text}
                    {badge}
                  </>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function YieldForm() {
  const profile = useProfileStore((state) => state.profile);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const defaultCrop = YIELD_CROPS.find((crop) => crop === profile?.primaryCrops[0]) ?? 'Maize';
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<YieldFormInput, unknown, YieldFormValues>({
    resolver: zodResolver(yieldSchema),
    defaultValues: {
      crop: defaultCrop,
      acres: profile && profile.acres > 0 ? profile.acres : 1,
      season: 'major',
      fertilizer: 'both',
      irrigation: 'rainfed',
    },
  });
  const values = useWatch({ control });
  const crop = values.crop ?? defaultCrop;
  const parsed = yieldSchema.safeParse(values);
  const stale = Boolean(
    estimate && (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(estimate.input)),
  );
  const strength = inputStrength({
    season: values.season ?? 'major',
    fertilizer: values.fertilizer ?? 'both',
    irrigation: values.irrigation ?? 'rainfed',
  });
  const acres = Number(values.acres);
  const validAcres = Number.isFinite(acres) && acres > 0 ? acres : 0;

  function setAcres(next: number) {
    const clamped = Math.min(1000, Math.max(0.1, Math.round(next * 10) / 10));
    setValue('acres', clamped, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal size={17} aria-hidden="true" className="text-ink-green" />
                Plan your harvest
              </CardTitle>
              <CardSub>Tell us what you’re growing and how</CardSub>
            </div>
          </CardHeader>
          <form
            noValidate
            onSubmit={handleSubmit(async (input) => {
              try {
                // Await also supports a future API-backed implementation of predictYield.
                const result = await predictYield(input);
                setEstimate({ input, result });
              } catch {
                toast.error('Could not predict your yield. Please try again.');
              }
            })}
            className="@container space-y-5"
          >
            <fieldset>
              <legend className={legendClass}>1. Crop</legend>
              <div className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
                {YIELD_CROPS.map((option) => {
                  const active = crop === option;
                  return (
                    <label key={option} className="relative">
                      <input
                        type="radio"
                        value={option}
                        className="peer sr-only"
                        {...register('crop')}
                      />
                      <span
                        className={cn(
                          'peer-focus-visible:outline-accent flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors peer-focus-visible:outline-2',
                          active ? activeClass : idleClass,
                        )}
                      >
                        <CropIcon
                          crop={option}
                          size={16}
                          className={active ? undefined : CROP_TONES[option].split(' ')[1]}
                        />
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="yield-acres" className={cn(legendClass, 'block')}>
                2. Farm size (acres)
              </label>
              <div className="flex items-stretch gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  icon={Minus}
                  aria-label="Decrease acreage"
                  onClick={() => setAcres((validAcres || 1) - 1)}
                  disabled={validAcres <= 0.1}
                  className="shrink-0 px-3"
                />
                <Input
                  id="yield-acres"
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={1000}
                  step="any"
                  placeholder="e.g. 2"
                  error={Boolean(errors.acres)}
                  aria-describedby={errors.acres ? fieldErrorId('yield-acres') : undefined}
                  className="text-center text-base font-bold tabular-nums"
                  {...register('acres')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  icon={Plus}
                  aria-label="Increase acreage"
                  onClick={() => setAcres(validAcres + 1)}
                  disabled={validAcres >= 1000}
                  className="shrink-0 px-3"
                />
              </div>
              {errors.acres && (
                <p
                  id={fieldErrorId('yield-acres')}
                  role="alert"
                  className="text-ink-red mt-1.5 text-xs"
                >
                  {errors.acres.message}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Quick acreage">
                {ACRE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAcres(preset)}
                    aria-pressed={validAcres === preset}
                    className={cn(
                      'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                      validAcres === preset ? activeClass : idleClass,
                    )}
                  >
                    {preset} {preset === 1 ? 'acre' : 'acres'}
                  </button>
                ))}
                {profile &&
                  profile.acres > 0 &&
                  !(ACRE_PRESETS as readonly number[]).includes(profile.acres) && (
                    <button
                      type="button"
                      onClick={() => setAcres(profile.acres)}
                      aria-pressed={validAcres === profile.acres}
                      className={cn(
                        'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                        validAcres === profile.acres ? activeClass : idleClass,
                      )}
                    >
                      My farm ({profile.acres})
                    </button>
                  )}
              </div>
            </div>

            <OptionCards
              legend="3. Season"
              options={SEASON_OPTIONS}
              selected={values.season}
              boosts={YIELD_MULTIPLIERS.season}
              registration={register('season')}
              columns="grid-cols-1 @sm:grid-cols-2"
            />
            <OptionCards
              legend="4. Fertilizer"
              options={FERTILIZER_OPTIONS}
              selected={values.fertilizer}
              boosts={YIELD_MULTIPLIERS.fertilizer}
              registration={register('fertilizer')}
              columns="grid-cols-1 @sm:grid-cols-2"
            />
            <OptionCards
              legend="5. Irrigation"
              options={IRRIGATION_OPTIONS}
              selected={values.irrigation}
              boosts={YIELD_MULTIPLIERS.irrigation}
              registration={register('irrigation')}
              columns="grid-cols-1 @sm:grid-cols-3"
              stacked
            />

            <div className="border-border bg-glass rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-dim inline-flex items-center gap-1.5 font-semibold">
                  <Gauge size={14} aria-hidden="true" className="text-ink-green" />
                  Input strength
                </span>
                <span className="text-text font-bold tabular-nums">
                  +{strength.boost}% vs. no inputs
                </span>
              </div>
              <div
                role="meter"
                aria-label="Input strength"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(strength.share * 100)}
                aria-valuetext={`${Math.round(strength.share * 100)}% of the best possible inputs`}
                className="bg-glass-strong mt-2.5 h-2 overflow-hidden rounded-full"
              >
                <div
                  className="h-full rounded-full bg-linear-to-r from-[#f5c451] to-[#10b981] transition-[width] duration-500"
                  style={{ width: `${Math.max(4, strength.share * 100)}%` }}
                />
              </div>
              <p className="text-text-mute mt-2 text-[11px]">
                {strength.share >= 1
                  ? 'You’ve chosen the strongest combination of inputs.'
                  : `${Math.round(strength.share * 100)}% of the best possible inputs.`}
              </p>
            </div>

            <Button type="submit" icon={Sparkles} loading={isSubmitting} className="w-full">
              {estimate ? 'Predict again' : 'Predict Yield'}
            </Button>
            <p className="text-text-mute text-center text-[11px] leading-relaxed">
              A planning estimate based on crop, acreage and inputs. Actual harvests vary with field
              conditions.
            </p>
          </form>
        </Card>

        <div aria-live="polite" className="space-y-6">
          {estimate ? (
            <>
              <YieldResult
                key={JSON.stringify(estimate.input)}
                input={estimate.input}
                result={estimate.result}
                stale={stale}
              />
              {!stale && <YieldBoosts input={estimate.input} result={estimate.result} />}
            </>
          ) : (
            <Card className="rounded-3xl">
              <div className="flex min-h-96 flex-col items-center justify-center px-4 py-8 text-center">
                <span className="bg-accent/15 text-ink-green inline-flex size-16 items-center justify-center rounded-2xl">
                  <ChartNoAxesCombined size={30} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-text mt-5 text-lg font-bold">
                  See what your season could bring
                </h3>
                <p className="text-text-dim mt-1.5 max-w-sm text-sm">
                  Choose your crop and farm inputs, then predict your harvest range and expected
                  revenue.
                </p>
                <ul className="mt-6 grid w-full max-w-sm gap-2 text-left">
                  {[
                    { icon: Wheat, text: 'Harvest range in tonnes' },
                    { icon: Banknote, text: 'Expected revenue at market price' },
                    { icon: Sparkles, text: 'Which inputs would raise it most' },
                  ].map(({ icon: Icon, text }) => (
                    <li
                      key={text}
                      className="border-border bg-glass text-text-dim flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-xs"
                    >
                      <Icon size={15} aria-hidden="true" className="text-ink-green shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </div>
      </div>
      <YieldTips crop={crop} />
    </>
  );
}
