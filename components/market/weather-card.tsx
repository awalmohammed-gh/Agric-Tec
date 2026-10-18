import { Clock3, Droplets, MapPin, Umbrella } from 'lucide-react';
import { WeatherIcon } from '@/components/ui/weather-icon';
import type { WeatherSnapshot } from '@/services/market.service';

const updateTime = new Intl.DateTimeFormat('en-GH', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Accra',
});

export function WeatherCard({
  weather,
  region = 'Greater Accra',
}: {
  weather: WeatherSnapshot;
  region?: string;
}) {
  return (
    <section
      aria-label="Demo weather"
      className="shadow-glass relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-[#173c76] via-[#263d82] to-[#5b328b] p-5 text-white sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full border-[40px] border-white/5"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-white/70 uppercase">
            Your weather snapshot
          </p>
          <h3 className="mt-2 flex items-start gap-1.5 text-sm font-semibold">
            <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-white/70" />
            {region.trim() || 'Greater Accra'}, Ghana
          </h3>
        </div>
        <WeatherIcon condition={weather.condition} size={64} className="shrink-0 text-white" />
      </div>
      <div className="relative my-6 grid flex-1 grid-cols-[minmax(0,1fr)_92px] items-center gap-4">
        <div>
          <p className="font-display text-[56px] leading-none font-bold tracking-tight tabular-nums">
            {weather.temp}
            <span className="align-top text-2xl leading-normal font-medium">°C</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{weather.description}</p>
          <span className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">
            Demo conditions
          </span>
        </div>
        <dl className="space-y-2.5">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <dt className="flex items-center gap-1 text-[10px] text-white/75">
              <Droplets size={12} aria-hidden="true" />
              Humidity
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{weather.humidity}%</dd>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <dt className="flex items-center gap-1 text-[10px] text-white/75">
              <Umbrella size={12} aria-hidden="true" />
              Rain
            </dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{weather.rainChance}%</dd>
          </div>
        </dl>
      </div>
      <p className="relative flex items-center gap-1.5 border-t border-white/15 pt-4 text-[11px] text-white/75">
        <Clock3 size={12} aria-hidden="true" />
        Last updated:{' '}
        <time dateTime={weather.updatedAt}>{updateTime.format(new Date(weather.updatedAt))}</time>
      </p>
    </section>
  );
}
