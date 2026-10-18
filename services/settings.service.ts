import { delay, storage, userKey } from '@/services/storage';
import type { AppSettings } from '@/types';

const key = (userId: string) => userKey(userId, 'settings');

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  notifications: { aiInsights: true, weatherAlerts: true, priceAlerts: true },
};

export const settingsService = {
  async get(userId: string): Promise<AppSettings> {
    await delay();
    const saved = storage.get<AppSettings | null>(key(userId), null);
    return {
      language: saved?.language ?? DEFAULT_SETTINGS.language,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...saved?.notifications },
    };
  },

  async save(userId: string, settings: AppSettings): Promise<AppSettings> {
    await delay();
    storage.set(key(userId), settings);
    return settings;
  },
};
