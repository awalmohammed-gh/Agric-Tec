// Market, weather, crop, assistant and crop-doctor content. Reads are open (the farmer app uses
// them); every save needs content.manage and is audited. Defaults equal the old constants.

import { withAudit } from '@/lib/admin/audit';
import {
  DEFAULT_ASSISTANT_KB,
  DEFAULT_CROP_CONTENT,
  DEFAULT_DIAGNOSES,
  DEFAULT_MARKET_PRICES,
} from '@/lib/admin/defaults';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  assistantKbSchema,
  cropContentSchema,
  diagnosesContentSchema,
  marketPricesSchema,
  parseOrThrow,
  weatherSchema,
} from '@/lib/admin/schemas';
import { delay, storage } from '@/services/storage';
import type { MarketPrice, Weather } from '@/types';
import type { AssistantKnowledgeItem, CropContent, DiagnosisContent } from '@/types/admin';
import type { z } from 'zod';

/** Validates, audits and stores one content key. */
function saveContent<T>(
  key: string,
  schema: z.ZodType<T>,
  value: T,
  action: string,
  summary: string,
): Promise<T> {
  return withAudit(
    {
      permission: 'content.manage',
      action,
      targetType: 'content',
      targetId: key.replace('platform:content:', ''),
      summary,
      before: storage.get<T | null>(key, null),
    },
    async () => {
      const valid = parseOrThrow(schema, value);
      storage.set(key, valid);
      return valid;
    },
  );
}

export const contentService = {
  async getMarketPrices(): Promise<MarketPrice[]> {
    await delay();
    return storage.get<MarketPrice[]>(PLATFORM_KEYS.market, DEFAULT_MARKET_PRICES);
  },

  async saveMarketPrices(prices: MarketPrice[]): Promise<MarketPrice[]> {
    await delay();
    return saveContent(
      PLATFORM_KEYS.market,
      marketPricesSchema,
      prices,
      'content.market',
      `Updated ${prices.length} market prices`,
    );
  },

  /** When set, the farmer app shows this instead of the simulated weather. */
  async getWeatherOverride(): Promise<Weather | null> {
    await delay();
    return storage.get<Weather | null>(PLATFORM_KEYS.weatherOverride, null);
  },

  async saveWeatherOverride(weather: Weather | null): Promise<Weather | null> {
    await delay();
    return withAudit(
      {
        permission: 'content.manage',
        action: weather ? 'content.weather_override' : 'content.weather_clear',
        targetType: 'content',
        targetId: 'weather-override',
        summary: weather
          ? `Set the weather to “${weather.description}”, ${weather.temp}°C`
          : 'Cleared the weather override',
        before: storage.get<Weather | null>(PLATFORM_KEYS.weatherOverride, null),
      },
      async () => {
        const valid = weather ? parseOrThrow(weatherSchema, weather) : null;
        storage.set(PLATFORM_KEYS.weatherOverride, valid);
        return valid;
      },
    );
  },

  async getCrops(): Promise<CropContent[]> {
    await delay();
    return storage.get<CropContent[]>(PLATFORM_KEYS.crops, DEFAULT_CROP_CONTENT);
  },

  async saveCrops(crops: CropContent[]): Promise<CropContent[]> {
    await delay();
    return saveContent(
      PLATFORM_KEYS.crops,
      cropContentSchema,
      crops,
      'content.crops',
      'Updated crop yields, prices and tips',
    );
  },

  /** Highest priority first. */
  async getAssistantKb(): Promise<AssistantKnowledgeItem[]> {
    await delay();
    return [
      ...storage.get<AssistantKnowledgeItem[]>(PLATFORM_KEYS.assistantKb, DEFAULT_ASSISTANT_KB),
    ].sort((a, b) => b.priority - a.priority);
  },

  async saveAssistantKb(items: AssistantKnowledgeItem[]): Promise<AssistantKnowledgeItem[]> {
    await delay();
    if (new Set(items.map((i) => i.id)).size !== items.length) {
      throw new Error('Each assistant reply needs a unique ID.');
    }
    return saveContent(
      PLATFORM_KEYS.assistantKb,
      assistantKbSchema,
      items,
      'content.assistant',
      `Updated the assistant’s ${items.length} replies`,
    );
  },

  async getDiagnoses(): Promise<DiagnosisContent[]> {
    await delay();
    return storage.get<DiagnosisContent[]>(PLATFORM_KEYS.diagnoses, DEFAULT_DIAGNOSES);
  },

  async saveDiagnoses(items: DiagnosisContent[]): Promise<DiagnosisContent[]> {
    await delay();
    if (!items.some((d) => d.active)) {
      throw new Error(
        'Keep at least one diagnosis active, or the crop doctor has nothing to show.',
      );
    }
    return saveContent(
      PLATFORM_KEYS.diagnoses,
      diagnosesContentSchema,
      items,
      'content.diagnoses',
      `Updated ${items.length} crop diagnoses`,
    );
  },
};
