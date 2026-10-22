'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crosshair, Info, MapPin, MapPinned, X } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  OUTSIDE_GHANA,
  insideGhana,
  locationDefaults,
  locationPatch,
  locationSchema,
  type LocationValues,
} from '@/components/onboarding/onboarding-schemas';
import { StepHeader, type StepProps } from '@/components/onboarding/wizard-nav';
import { Button } from '@/components/ui/button';
import { FormField, fieldErrorId, fieldHintId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { constituenciesOf } from '@/constants/constituencies';
import { REGIONS } from '@/constants/regions';
import { formatGPS } from '@/lib/format';

/** Leaflet needs `window`, so the map loads in the browser only. */
const FarmMap = dynamic(() => import('@/components/onboarding/farm-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-2xl" />,
});

const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission was denied. Allow location access in your browser settings, or tap the map instead.',
  2: 'Your location is unavailable right now. Tap the map to place the pin instead.',
  3: 'Finding your location took too long. Try again, or tap the map instead.',
};

/** Step 2: region, constituency, community and (optionally) a pin on the map. */
export function StepLocation({
  formId,
  data,
  onSubmit,
  autoFocusHeading = true,
}: StepProps & { autoFocusHeading?: boolean }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: locationDefaults(data),
  });
  const region = useWatch({ control, name: 'region' });
  const gps = useWatch({ control, name: 'gps' });
  const constituencies = constituenciesOf(region);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const setPin = (point: { lat: number; lng: number } | null) => {
    setMapMessage(null);
    setValue('gps', point, { shouldDirty: true, shouldValidate: true });
  };

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setMapMessage('This browser can’t share your location. Tap the map to place the pin.');
      return;
    }
    setLocating(true);
    setMapMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const point = {
          lat: Math.round(coords.latitude * 1e6) / 1e6,
          lng: Math.round(coords.longitude * 1e6) / 1e6,
        };
        if (!insideGhana(point)) {
          setMapMessage(OUTSIDE_GHANA);
          return;
        }
        setPin(point);
      },
      (error) => {
        setLocating(false);
        setMapMessage(GEO_ERRORS[error.code] ?? GEO_ERRORS[2]);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(locationPatch(values)))}
    >
      <StepHeader
        icon={MapPinned}
        title="Where is your farm?"
        description="Your region and constituency help lenders and our team know your area."
        autoFocus={autoFocusHeading}
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Region" htmlFor="onb-region" error={errors.region?.message}>
            <Select
              id="onb-region"
              error={Boolean(errors.region)}
              aria-describedby={errors.region ? fieldErrorId('onb-region') : undefined}
              {...register('region', {
                // A new region clears the constituency (it belonged to the old one).
                onChange: () => setValue('constituency', ''),
              })}
            >
              <option value="">Choose a region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Constituency"
            htmlFor="onb-constituency"
            error={errors.constituency?.message}
            hint={region ? undefined : 'Choose a region first.'}
          >
            <Select
              id="onb-constituency"
              disabled={!region}
              error={Boolean(errors.constituency)}
              aria-describedby={
                errors.constituency
                  ? fieldErrorId('onb-constituency')
                  : region
                    ? undefined
                    : fieldHintId('onb-constituency')
              }
              {...register('constituency')}
            >
              <option value="">{region ? 'Choose a constituency' : 'Pick a region first'}</option>
              {constituencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label="Community / town (optional)"
          htmlFor="onb-community"
          error={errors.community?.message}
        >
          <Input
            id="onb-community"
            placeholder="e.g. Ejura"
            maxLength={80}
            autoComplete="address-level3"
            error={Boolean(errors.community)}
            {...register('community')}
          />
        </FormField>

        <section
          aria-labelledby="onb-map-title"
          className="border-border bg-glass rounded-2xl border p-4"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id="onb-map-title"
                className="text-text flex items-center gap-1.5 text-sm font-semibold"
              >
                <MapPin size={15} aria-hidden="true" className="text-ink-green" />
                Pin your farm on the map
              </h3>
              <p className="text-text-mute mt-0.5 text-xs">
                Optional but recommended. Tap the map to drop a pin, then drag it into place.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Crosshair}
              loading={locating}
              onClick={locateMe}
              className="min-h-11"
            >
              Use my current location
            </Button>
          </div>

          <Controller
            control={control}
            name="gps"
            render={() => (
              <FarmMap
                value={gps}
                region={region || undefined}
                onChange={setPin}
                onOutside={() => setMapMessage(OUTSIDE_GHANA)}
                className="h-[300px] w-full sm:h-[340px]"
              />
            )}
          />

          <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-2">
            <p className="text-text-dim text-sm tabular-nums" aria-live="polite">
              {gps ? formatGPS(gps.lat, gps.lng) : 'No pin yet'}
            </p>
            {gps && (
              <Button type="button" size="sm" variant="ghost" icon={X} onClick={() => setPin(null)}>
                Remove pin
              </Button>
            )}
          </div>
          {(mapMessage || errors.gps?.message) && (
            <p role="alert" className="text-ink-red mt-1 text-xs font-semibold">
              {mapMessage ?? errors.gps?.message}
            </p>
          )}
          <p className="text-text-mute mt-2 flex items-start gap-1.5 text-xs">
            <Info size={13} aria-hidden="true" className="mt-px shrink-0" />
            Adding your exact location helps verify your farm and can raise your credit score.
          </p>
        </section>
      </div>
    </form>
  );
}
