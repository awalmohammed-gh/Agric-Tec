import { publishedPrices } from '@/lib/market/evidence';
import { contentService } from '@/services/admin/content.service';
import type { MarketPrice, PriceTrends, Weather } from '@/types';

/** Compatibility shape for integrations that still use the older current-weather model. */
export interface WeatherSnapshot extends Weather {
  updatedAt: string;
}

export const marketService = {
  /** No connected provider: never use old overrides, random conditions or session samples. */
  async getWeather(): Promise<WeatherSnapshot | null> {
    return null;
  },
  async getPrices(): Promise<MarketPrice[]> {
    return publishedPrices(await contentService.getMarketPrices());
  },
  /** Historical charts stay empty until source-backed observations are connected. */
  async getPriceTrends(_crops: string[], _months: number): Promise<PriceTrends> {
    void _crops;
    void _months;
    return { labels: [], series: [] };
  },
};
