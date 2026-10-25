// Market, weather, crop, assistant and crop-doctor content. Reads are open (the farmer app uses
// them); every save needs content.manage and is audited. Defaults equal the old constants.

import { getCurrentAdmin } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import {
  ASSISTANT_FALLBACK_ID,
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
import type {
  AssistantKnowledgeItem,
  ContentMeta,
  CropContent,
  DiagnosisContent,
} from '@/types/admin';
import type { z } from 'zod';

/** A deep copy of a stored value (or the default), so callers can never mutate shared defaults. */
const read = <T>(key: string, fallback: T): T => structuredClone(storage.get<T>(key, fallback));

/** Remembers who saved a content key, for "Last updated by X on date". */
function stampMeta(key: string): void {
  const meta = storage.get<Record<string, ContentMeta>>(PLATFORM_KEYS.contentMeta, {});
  storage.set(PLATFORM_KEYS.contentMeta, {
    ...meta,
    [key]: { by: getCurrentAdmin()?.name ?? 'Admin', at: new Date().toISOString() },
  });
}

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
      stampMeta(key);
      return valid;
    },
  );
}

const DEFAULT_FALLBACK = DEFAULT_ASSISTANT_KB.find((i) => i.id === ASSISTANT_FALLBACK_ID)!;

/** Older saved knowledge has no fallback item: add the default one so it can be edited. */
const withFallback = (items: AssistantKnowledgeItem[]) =>
  items.some((i) => i.id === ASSISTANT_FALLBACK_ID)
    ? items
    : [...items, structuredClone(DEFAULT_FALLBACK)];

export const contentService = {
  /** Who last saved each content type (keyed by PLATFORM_KEYS value). */
  async getContentMeta(): Promise<Record<string, ContentMeta>> {
    await delay();
    return read<Record<string, ContentMeta>>(PLATFORM_KEYS.contentMeta, {});
  },

  async getMarketPrices(): Promise<MarketPrice[]> {
    await delay();
    return read<MarketPrice[]>(PLATFORM_KEYS.market, DEFAULT_MARKET_PRICES).map((price, index) => ({
      ...price,
      id: price.id ?? `legacy-market-${index}`,
      status: price.status ?? 'draft',
    }));
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

  /** Legacy storage retained for migration; shared weather never treats overrides as live data. */
  async getWeatherOverride(): Promise<Weather | null> {
    await delay();
    return read<Weather | null>(PLATFORM_KEYS.weatherOverride, null);
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
        stampMeta(PLATFORM_KEYS.weatherOverride);
        return valid;
      },
    );
  },

  async getCrops(): Promise<CropContent[]> {
    await delay();
    return read<CropContent[]>(PLATFORM_KEYS.crops, DEFAULT_CROP_CONTENT);
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

  /** Highest priority first; the fallback (no match) reply is always included, last. */
  async getAssistantKb(): Promise<AssistantKnowledgeItem[]> {
    await delay();
    return withFallback(
      read<AssistantKnowledgeItem[]>(PLATFORM_KEYS.assistantKb, DEFAULT_ASSISTANT_KB),
    ).sort((a, b) => b.priority - a.priority);
  },

  async saveAssistantKb(items: AssistantKnowledgeItem[]): Promise<AssistantKnowledgeItem[]> {
    await delay();
    if (new Set(items.map((i) => i.id)).size !== items.length) {
      throw new Error('Each assistant reply needs a unique ID.');
    }
    if (!items.some((i) => i.id === ASSISTANT_FALLBACK_ID)) {
      throw new Error('The fallback reply can’t be deleted.');
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
    return read<DiagnosisContent[]>(PLATFORM_KEYS.diagnoses, DEFAULT_DIAGNOSES);
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
