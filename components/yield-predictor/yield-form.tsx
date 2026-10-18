'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { ChartNoAxesCombined, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { YieldResult } from '@/components/yield-predictor/yield-result';
import {
  YIELD_CROPS,
  yieldSchema,
  type YieldFormInput,
  type YieldFormValues,
} from '@/components/yield-predictor/yield-schema';
import { YieldTips } from '@/components/yield-predictor/yield-tips';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { predictYield } from '@/lib/calculations/yield';
import { useProfileStore } from '@/store/profile-store';
import type { YieldResult as Prediction } from '@/types';

interface Estimate {
  input: YieldFormValues;
  result: Prediction;
}

export function YieldForm() {
  const profile = useProfileStore((state) => state.profile);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const defaultCrop = YIELD_CROPS.find((crop) => crop === profile?.primaryCrops[0]) ?? 'Maize';
  const {
    register,
    handleSubmit,
    control,
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
  const describe = (id: string, invalid: boolean) => (invalid ? fieldErrorId(id) : undefined);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-2">
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
            className="space-y-4"
          >
            <FormField label="Crop Type" htmlFor="yield-crop" error={errors.crop?.message}>
              <Select
                id="yield-crop"
                error={Boolean(errors.crop)}
                aria-describedby={describe('yield-crop', Boolean(errors.crop))}
                {...register('crop')}
              >
                {YIELD_CROPS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Acreage" htmlFor="yield-acres" error={errors.acres?.message}>
                <Input
                  id="yield-acres"
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={1000}
                  step="any"
                  placeholder="e.g. 2"
                  error={Boolean(errors.acres)}
                  aria-describedby={describe('yield-acres', Boolean(errors.acres))}
                  {...register('acres')}
                />
              </FormField>
              <FormField label="Season" htmlFor="yield-season" error={errors.season?.message}>
                <Select
                  id="yield-season"
                  error={Boolean(errors.season)}
                  aria-describedby={describe('yield-season', Boolean(errors.season))}
                  {...register('season')}
                >
                  <option value="major">Major (Mar–Jul)</option>
                  <option value="minor">Minor (Aug–Dec)</option>
                </Select>
              </FormField>
            </div>
            <FormField
              label="Fertilizer Used"
              htmlFor="yield-fertilizer"
              error={errors.fertilizer?.message}
            >
              <Select
                id="yield-fertilizer"
                error={Boolean(errors.fertilizer)}
                aria-describedby={describe('yield-fertilizer', Boolean(errors.fertilizer))}
                {...register('fertilizer')}
              >
                <option value="both">Both organic and inorganic</option>
                <option value="inorganic">Inorganic fertilizer only</option>
                <option value="organic">Organic fertilizer only</option>
                <option value="none">No fertilizer</option>
              </Select>
            </FormField>
            <FormField
              label="Irrigation"
              htmlFor="yield-irrigation"
              error={errors.irrigation?.message}
            >
              <Select
                id="yield-irrigation"
                error={Boolean(errors.irrigation)}
                aria-describedby={describe('yield-irrigation', Boolean(errors.irrigation))}
                {...register('irrigation')}
              >
                <option value="rainfed">Rainfed (natural rainfall)</option>
                <option value="drip">Drip irrigation</option>
                <option value="sprinkler">Sprinkler irrigation</option>
              </Select>
            </FormField>
            <Button type="submit" icon={Sparkles} loading={isSubmitting} className="mt-2 w-full">
              Predict Yield
            </Button>
            <p className="text-text-mute text-center text-[11px] leading-relaxed">
              A planning estimate based on crop, acreage and inputs. Actual harvests vary with field
              conditions.
            </p>
          </form>
        </Card>
        <div aria-live="polite">
          {estimate ? (
            <YieldResult input={estimate.input} result={estimate.result} stale={stale} />
          ) : (
            <Card className="rounded-3xl">
              <EmptyState
                icon={ChartNoAxesCombined}
                title="See what your season could bring"
                description="Choose your crop and farm inputs, then predict your harvest range and expected revenue."
                className="min-h-96"
              />
            </Card>
          )}
        </div>
      </div>
      <YieldTips crop={crop} />
    </>
  );
}
