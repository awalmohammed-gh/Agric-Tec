import { create } from 'zustand';
import { DEFAULT_SETTINGS, settingsService } from '@/services/settings.service';
import type { Language, NotificationSettings, StoreStatus } from '@/types';

interface SettingsState {
  userId: string | null;
  language: Language;
  notifications: NotificationSettings;
  status: StoreStatus;
  load: (userId: string) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  toggleNotification: (key: keyof NotificationSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const requireUser = (): string => {
    const { userId } = get();
    if (!userId) throw new Error('You need to sign in first');
    return userId;
  };

  return {
    userId: null,
    language: DEFAULT_SETTINGS.language,
    notifications: DEFAULT_SETTINGS.notifications,
    status: 'idle',

    load: async (userId) => {
      set({ userId, status: 'loading' });
      try {
        const settings = await settingsService.get(userId);
        if (get().userId !== userId) return;
        set({ ...settings, status: 'ready' });
      } catch (error) {
        set({ status: 'error' });
        throw error;
      }
    },

    setLanguage: async (language) => {
      const saved = await settingsService.save(requireUser(), {
        language,
        notifications: get().notifications,
      });
      set({ language: saved.language });
    },

    toggleNotification: async (key) => {
      const { language, notifications } = get();
      const saved = await settingsService.save(requireUser(), {
        language,
        notifications: { ...notifications, [key]: !notifications[key] },
      });
      set({ notifications: saved.notifications });
    },
  };
});
