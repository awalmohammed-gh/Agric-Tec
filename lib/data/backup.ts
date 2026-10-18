import { backupSchema, type DataBackup } from '@/lib/data/backup-schema';
import { safeProfile } from '@/lib/profile';
import { defaultProfile } from '@/services/profile.service';
import { storage } from '@/services/storage';
import { loadAllStores, resetAllStores } from '@/store';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useFarmStore } from '@/store/farm-store';
import { useLoanStore } from '@/store/loan-store';
import { useProfileStore, waitForProfileSaves } from '@/store/profile-store';
import { useSettingsStore, waitForSettingsSaves } from '@/store/settings-store';

function currentUser(): string {
  const id = useAuthStore.getState().session?.userId;
  if (!id) throw new Error('Sign in before managing your data.');
  return id;
}

export function createDataBackup(): DataBackup {
  const userId = currentUser();
  const farm = useFarmStore.getState();
  const settings = useSettingsStore.getState();
  if (
    [
      farm.userId,
      settings.userId,
      useProfileStore.getState().userId,
      useChatStore.getState().userId,
    ].some((id) => id !== userId)
  )
    throw new Error('Your data is still loading. Please try again.');
  return backupSchema.parse({
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: safeProfile(useProfileStore.getState().profile ?? defaultProfile(userId)),
    records: farm.records,
    momo: farm.momo,
    diagnoses: farm.diagnoses, // The schema strips imageThumb from the returned backup.
    chat: useChatStore.getState().messages,
    settings: { language: settings.language, notifications: settings.notifications },
    loanApplications:
      useLoanStore.getState().userId === userId ? useLoanStore.getState().applications : [],
  });
}

export async function importDataBackup(input: DataBackup): Promise<void> {
  const data = backupSchema.parse(input); // Validate again immediately before mutation.
  const userId = currentUser();
  await Promise.all([waitForProfileSaves(), waitForSettingsSaves()]);
  if (currentUser() !== userId) throw new Error('Your session changed. Please try again.');
  const rebind = <T extends { userId: string }>(items: T[]) =>
    items.map((item) => ({ ...item, userId }));
  storage.replaceUser(userId, {
    profile: safeProfile({ ...data.profile, userId }),
    records: rebind(data.records),
    momo: rebind(data.momo),
    diagnoses: rebind(data.diagnoses),
    chat: data.chat,
    settings: data.settings,
    loanApplications: rebind(data.loanApplications),
  });
  resetAllStores();
  await loadAllStores(userId);
}

export async function deleteUserData(confirmation: string): Promise<void> {
  if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.');
  const userId = currentUser();
  await Promise.all([waitForProfileSaves(), waitForSettingsSaves()]);
  if (currentUser() !== userId) throw new Error('Your session changed. Please try again.');
  storage.clearUser(userId);
  resetAllStores();
  await loadAllStores(userId);
}
