import { DEFAULT_SETTINGS } from '@/services/settings.service';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useFarmStore } from '@/store/farm-store';
import { useLoanStore } from '@/store/loan-store';
import { useProfileStore } from '@/store/profile-store';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { useModalStore } from '@/store/modal-store';
import { useReportStore } from '@/store/report-store';

export { useAuthStore, useChatStore, useFarmStore, useProfileStore, useSettingsStore };

/** Loads every user-data store in parallel. Await this before rendering the app shell. */
export async function loadAllStores(userId: string): Promise<void> {
  await Promise.all([
    useFarmStore.getState().load(userId),
    useProfileStore.getState().load(userId),
    useChatStore.getState().load(userId),
    useSettingsStore.getState().load(userId),
    useLoanStore.getState().load(userId),
  ]);
}

/** Empties every in-memory store, so no data from the previous user is left behind. */
export function resetAllStores(): void {
  useModalStore.getState().closeModal();
  useReportStore.getState().closePreview();
  useFarmStore.setState({ userId: null, records: [], momo: [], diagnoses: [], status: 'idle' });
  useProfileStore.setState({ userId: null, profile: null, status: 'idle' });
  useChatStore.setState({ userId: null, messages: [], isTyping: false, status: 'idle' });
  useSettingsStore.setState({
    userId: null,
    language: DEFAULT_SETTINGS.language,
    notifications: DEFAULT_SETTINGS.notifications,
    status: 'idle',
  });
  useUiStore.setState({ mobileNavOpen: false });
  useLoanStore.setState({
    userId: null,
    applications: [],
    status: 'idle',
    lastDraft: null,
    confirm: null,
  });
}

/** Ends the session (clears it and the proxy cookie), then wipes the in-memory stores. */
export async function signOutAndReset(): Promise<void> {
  await useAuthStore.getState().signOut();
  resetAllStores();
}
