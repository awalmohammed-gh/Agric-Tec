import { z } from 'zod';
import { validWeatherLocation, weatherLocationKey } from '@/lib/market/weather-location';
import type {
  IntegrationResult,
  WeatherLocation,
  WeatherProvider,
  WeatherReport,
} from '@/types/market';

const percent = z.number().min(0).max(100);
const temp = z.number().min(-100).max(65);
const description = z.string().min(1).max(200);
const reportSchema = z.object({
  provider: z.string().min(1),
  updatedAt: z.iso.datetime(),
  location: z.custom<WeatherLocation>(validWeatherLocation),
  current: z.object({
    temp,
    description,
    humidity: percent,
    rainMm: z.number().min(0),
    rainChance: percent,
    windKph: z.number().min(0),
  }),
  daily: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description,
        minTemp: temp,
        maxTemp: temp,
        rainMm: z.number().min(0),
        rainChance: percent,
        windKph: z.number().min(0),
      }),
    )
    .max(16),
  upcoming: z
    .array(z.object({ time: z.iso.datetime(), description, temp, rainChance: percent }))
    .max(48),
});

export const weatherService = {
  async getForecast(
    location: WeatherLocation,
    options: { provider?: WeatherProvider; signal?: AbortSignal } = {},
  ): Promise<IntegrationResult<WeatherReport>> {
    if (!validWeatherLocation(location))
      throw new Error('Select a valid location before requesting weather.');
    if (!options.provider)
      return {
        status: 'unavailable',
        message: 'Weather data unavailable',
        reason:
          'A real weather provider is not connected yet. No current readings or forecasts are being generated.',
      };
    const raw = await options.provider.getForecast(location, options.signal);
    const parsed = reportSchema.safeParse(raw);
    if (
      !parsed.success ||
      weatherLocationKey(parsed.data.location) !== weatherLocationKey(location) ||
      Date.parse(parsed.data.updatedAt) > Date.now() + 300000 ||
      parsed.data.daily.some((day) => day.minTemp > day.maxTemp)
    )
      return {
        status: 'unavailable',
        message: 'Weather data unavailable',
        reason: 'The provider did not return complete weather for the selected location.',
      };
    return { status: 'ready', data: parsed.data };
  },
};
