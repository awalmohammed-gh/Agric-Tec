'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { LastUpdated } from '@/components/admin/content/content-kit';
import { PRIMARY_CLASS } from '@/components/admin/shared/action-styles';
import { WeatherCard } from '@/components/market/weather-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { WeatherIcon } from '@/components/ui/weather-icon';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { weatherSchema } from '@/lib/admin/schemas';
import { cn } from '@/lib/utils';
import { contentService } from '@/services/admin/content.service';
import type { Weather, WeatherCondition } from '@/types';
import type { ContentMeta } from '@/types/admin';

const CONDITIONS: { value: WeatherCondition; label: string; description: string }[] = [
  { value: 'sunny', label: 'Sunny', description: 'Sunny and dry' },
  { value: 'partly-cloudy', label: 'Partly cloudy', description: 'Partly cloudy' },
  { value: 'showers', label: 'Showers', description: 'Scattered showers' },
  { value: 'storm', label: 'Storm', description: 'Thunderstorms likely' },
];

const DEFAULT_OVERRIDE: Weather = {
  condition: 'storm',
  temp: 27,
  description: 'Thunderstorms likely this afternoon',
  humidity: 85,
  rainChance: 90,
};

type Field = 'temp' | 'description' | 'humidity' | 'rainChance';

/**
 * "Override farmer weather": when on, every farmer sees these conditions (and the advice that
 * follows from them) instead of the simulated weather. Off = the normal mock weather.
 */
export function WeatherOverride() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Weather | null>(null);
  const [on, setOn] = useState(false);
  const [draft, setDraft] = useState<Weather>(DEFAULT_OVERRIDE);
  const [meta, setMeta] = useState<ContentMeta | undefined>();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [previewTime] = useState(() => new Date().toISOString());

  useEffect(() => {
    let active = true;
    Promise.all([contentService.getWeatherOverride(), contentService.getContentMeta()]).then(
      ([override, metas]) => {
        if (!active) return;
        setSaved(override);
        setOn(override !== null);
        if (override) setDraft(override);
        setMeta(metas[PLATFORM_KEYS.weatherOverride]);
        setLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, [version]);

  if (!loaded) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const dirty = on ? JSON.stringify(draft) !== JSON.stringify(saved) : saved !== null;
  const set = <K extends keyof Weather>(key: K, value: Weather[K]) =>
    setDraft({ ...draft, [key]: value });

  async function save() {
    let next: Weather | null = null;
    if (on) {
      const parsed = weatherSchema.safeParse(draft);
      if (!parsed.success) {
        const found: Partial<Record<Field, string>> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as Field;
          found[field] ??=
            field === 'temp'
              ? 'Use −10 to 60 °C.'
              : field === 'description'
                ? 'Describe the weather (up to 80 characters).'
                : 'Use 0 to 100%.';
        }
        setErrors(found);
        return;
      }
      next = parsed.data;
    }
    setErrors({});
    setSaving(true);
    try {
      await contentService.saveWeatherOverride(next);
      toast.success(next ? 'Weather override is on' : 'Farmers see the normal weather again');
      setVersion((v) => v + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the weather');
    } finally {
      setSaving(false);
    }
  }

  const numberField = (
    key: 'temp' | 'humidity' | 'rainChance',
    label: string,
    unit: string,
    min: number,
    max: number,
  ) => (
    <label className="min-w-0">
      <span className="text-text-dim mb-1.5 block text-xs font-semibold">{label}</span>
      <span
        className={cn(
          'bg-bg-2 focus-within:border-purple/70 flex min-h-11 items-center rounded-xl border pr-3',
          errors[key] ? 'border-danger' : 'border-border',
        )}
      >
        <input
          type="number"
          min={min}
          max={max}
          inputMode="numeric"
          value={Number.isFinite(draft[key]) ? draft[key] : ''}
          onChange={(e) => set(key, Number(e.target.value || NaN))}
          aria-invalid={errors[key] ? true : undefined}
          className="text-text min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm font-semibold tabular-nums outline-none"
        />
        <span className="text-text-mute text-xs">{unit}</span>
      </span>
      {errors[key] && (
        <span role="alert" className="text-ink-red mt-1 block text-xs">
          {errors[key]}
        </span>
      )}
    </label>
  );

  return (
    <section aria-labelledby="weather-title" className="border-border bg-glass rounded-2xl border">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 id="weather-title" className="text-text text-sm font-semibold">
            Weather override
          </h2>
          <LastUpdated meta={meta} className="mt-1" />
        </div>
        <Button
          size="sm"
          icon={Save}
          loading={saving}
          disabled={!dirty}
          onClick={() => void save()}
          className={PRIMARY_CLASS}
        >
          Save
        </Button>
      </header>

      <div className="px-5 pb-5">
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-xl border px-4 py-2',
            on ? 'border-gold/40 bg-gold/8' : 'border-border',
          )}
        >
          <div>
            <p className="text-text text-sm font-semibold">Override farmer weather</p>
            <p className="text-text-mute text-xs">
              {on
                ? 'Every farmer sees the conditions below, and the advice that follows from them.'
                : 'Off: farmers get the normal simulated weather.'}
            </p>
          </div>
          <Switch checked={on} onChange={setOn} label="Override farmer weather" />
        </div>

        {on && (
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <div className="space-y-4">
              <fieldset>
                <legend className="text-text-dim mb-2 text-xs font-semibold">Conditions</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CONDITIONS.map((c) => {
                    const selected = draft.condition === c.value;
                    return (
                      <label
                        key={c.value}
                        className={cn(
                          'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors',
                          selected
                            ? 'border-purple/60 bg-purple/12 text-text'
                            : 'border-border text-text-dim hover:bg-glass-strong',
                        )}
                      >
                        <input
                          type="radio"
                          name="weather-condition"
                          value={c.value}
                          checked={selected}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              condition: c.value,
                              description: CONDITIONS.some(
                                (x) => x.description === draft.description,
                              )
                                ? c.description
                                : draft.description,
                            })
                          }
                          className="sr-only"
                        />
                        <WeatherIcon condition={c.value} size={30} />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-text-dim mb-1.5 block text-xs font-semibold">
                  Description
                </span>
                <input
                  value={draft.description}
                  maxLength={80}
                  onChange={(e) => set('description', e.target.value)}
                  aria-invalid={errors.description ? true : undefined}
                  className={cn(
                    'bg-bg-2 text-text focus:border-purple/70 min-h-11 w-full rounded-xl border px-3.5 text-sm outline-none',
                    errors.description ? 'border-danger' : 'border-border',
                  )}
                />
                {errors.description && (
                  <span role="alert" className="text-ink-red mt-1 block text-xs">
                    {errors.description}
                  </span>
                )}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {numberField('temp', 'Temperature', '°C', -10, 60)}
                {numberField('humidity', 'Humidity', '%', 0, 100)}
                {numberField('rainChance', 'Rain chance', '%', 0, 100)}
              </div>
            </div>
            <div>
              <p className="text-text-mute mb-2 text-xs font-semibold">What farmers see</p>
              <WeatherCard
                weather={{
                  ...draft,
                  temp: Number.isFinite(draft.temp) ? draft.temp : 0,
                  humidity: Number.isFinite(draft.humidity) ? draft.humidity : 0,
                  rainChance: Number.isFinite(draft.rainChance) ? draft.rainChance : 0,
                  updatedAt: previewTime,
                }}
                region="Northern"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
