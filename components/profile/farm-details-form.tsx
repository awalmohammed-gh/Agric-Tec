'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Sprout } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CropChipsInput } from '@/components/profile/crop-chips-input';
import { farmSchema, type FarmInput, type FarmValues } from '@/components/profile/profile-schema';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useT } from '@/lib/i18n';
import { useProfileStore } from '@/store/profile-store';
import type { Crop } from '@/types';

export function FarmDetailsForm() {
  const profile = useProfileStore((state) => state.profile);
  const save = useProfileStore((state) => state.save);
  const t = useT();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FarmInput, unknown, FarmValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      farmName: profile?.farmName ?? '',
      acres: profile?.acres ?? 0,
      farmType: profile?.farmType ?? 'Smallholder',
      primaryCrops: (profile?.primaryCrops ?? []) as Crop[],
    },
  });
  return (
    <Card id="farm-details" className="h-full scroll-mt-24 rounded-3xl">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sprout size={18} aria-hidden="true" className="text-ink-green" />
            Farm details
          </CardTitle>
          <CardSub>Help tailor advice to what you grow</CardSub>
        </div>
      </CardHeader>
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          try {
            await save(values);
            reset(values);
            toast.success('Profile updated');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update your farm');
          }
        })}
        className="space-y-4"
      >
        <FormField label="Farm name" htmlFor="profile-farm-name" error={errors.farmName?.message}>
          <Input
            id="profile-farm-name"
            maxLength={80}
            error={Boolean(errors.farmName)}
            {...register('farmName')}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Acreage" htmlFor="profile-acres" error={errors.acres?.message}>
            <Input
              id="profile-acres"
              type="number"
              inputMode="decimal"
              min={0}
              max={10000}
              step="any"
              error={Boolean(errors.acres)}
              aria-describedby={errors.acres ? fieldErrorId('profile-acres') : undefined}
              {...register('acres')}
            />
          </FormField>
          <FormField label="Farm type" htmlFor="profile-farm-type" error={errors.farmType?.message}>
            <Select id="profile-farm-type" {...register('farmType')}>
              <option>Smallholder</option>
              <option>Commercial</option>
              <option>Cooperative</option>
            </Select>
          </FormField>
        </div>
        <fieldset>
          <legend className="text-text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
            Primary crops
          </legend>
          <Controller
            name="primaryCrops"
            control={control}
            render={({ field }) => (
              <CropChipsInput
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          <p className="text-text-mute mt-2 text-xs">Choose up to 5 crops.</p>
          {errors.primaryCrops && (
            <p role="alert" className="text-ink-red mt-1 text-xs">
              {errors.primaryCrops.message}
            </p>
          )}
        </fieldset>
        <Button
          type="submit"
          icon={Save}
          disabled={!isDirty}
          loading={isSubmitting}
          className="w-full"
        >
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}
