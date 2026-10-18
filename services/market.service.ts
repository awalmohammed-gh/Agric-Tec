import { format, getMonth, getYear, startOfMonth, subMonths } from 'date-fns';
import { MARKET_PRICES } from '@/data/mock/market-prices';
import { WEATHER_CONDITIONS } from '@/data/mock/weather';
import { delay, sessionStore } from '@/services/storage';
import type { MarketPrice, PriceTrends, Weather } from '@/types';

const WEATHER_KEY = 'weather';

/** Small, fast seeded PRNG: the same seed always returns the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns a string into a 32-bit number to use as a seed. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const marketService = {
  /** Picks one weather condition per browser session, so it stays the same until the tab closes. */
  async getWeather(): Promise<Weather> {
    await delay();
    const saved = sessionStore.get<Weather | null>(WEATHER_KEY, null);
    if (saved) return saved;
    // The only random pick: once per session, then reused.
    const picked = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
    sessionStore.set(WEATHER_KEY, picked);
    return picked;
  },

  async getPrices(): Promise<MarketPrice[]> {
    await delay();
    return MARKET_PRICES;
  },

  /**
   * Deterministic price history for each crop over the last N months.
   * Each point is seeded from the crop name plus the calendar month, so the lines never jump
   * between renders, and the latest month always equals today's price.
   */
  async getPriceTrends(crops: string[], months: number): Promise<PriceTrends> {
    await delay();
    const thisMonth = startOfMonth(new Date());
    const monthStarts = Array.from({ length: months }, (_, i) =>
      subMonths(thisMonth, months - 1 - i),
    );

    return {
      labels: monthStarts.map((month) => format(month, 'MMM')),
      series: crops.map((crop) => {
        const current = MARKET_PRICES.find((p) => p.crop === crop)?.price ?? 100;
        const prices = monthStarts.map((month, i) => {
          if (i === months - 1) return current;
          const monthIndex = getYear(month) * 12 + getMonth(month);
          const random = mulberry32(hashString(`${crop}:${monthIndex}`))();
          return Math.round(current * (0.88 + random * 0.24)); // within ±12% of today
        });
        return { crop, prices };
      }),
    };
  },
};
