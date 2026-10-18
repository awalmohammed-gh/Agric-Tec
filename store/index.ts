import { useChatStore } from '@/store/chat-store';
import { useFarmStore } from '@/store/farm-store';
import { useProfileStore } from '@/store/profile-store';
import { useSettingsStore } from '@/store/settings-store';

export { useAuthStore } from '@/store/auth-store';
export { useChatStore, useFarmStore, useProfileStore, useSettingsStore };

/** Loads every user-data store in parallel. Await this before rendering the app shell. */
export async function loadAllStores(userId: string): Promise<void> {
  await Promise.all([
    useFarmStore.getState().load(userId),
    useProfileStore.getState().load(userId),
    useChatStore.getState().load(userId),
    useSettingsStore.getState().load(userId),
  ]);
}
