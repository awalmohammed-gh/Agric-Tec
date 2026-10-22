import { backupSchema, type DataBackup } from '@/lib/data/backup-schema';
import { readProfile } from '@/lib/admin/farmer-data';
import { normalizeProfile, safeProfile } from '@/lib/profile';
import { defaultProfile } from '@/services/profile.service';
import { FARMER_ADMIN_META } from '@/lib/admin/keys';
import { assertWritable } from '@/lib/read-only';
import { storage, userKey } from '@/services/storage';
import { loadAllStores, resetAllStores } from '@/store';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useFarmStore } from '@/store/farm-store';
import { useLoanStore } from '@/store/loan-store';
import { useProfileStore, waitForProfileSaves } from '@/store/profile-store';
import { useSettingsStore, waitForSettingsSaves } from '@/store/settings-store';

/**
 * Per-user keys the farmer's own import/delete must keep: the admin's notes and tags on this
 * farmer, and the announcements they dismissed. Loan applications live at platform level since
 * the admin console (a backup lists them, but restoring one never rewrites lender decisions).
 */
const KEPT_KEYS = [FARMER_ADMIN_META, 'dismissed-announcements'];

function keptData(userId: string): Record<string, unknown> {
  return Object.fromEntries(
    KEPT_KEYS.map((name) => [name, storage.get<unknown>(userKey(userId, name), null)]).filter(
      ([, value]) => value !== null,
    ),
  );
}

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
  assertWritable();
  const data = backupSchema.parse(input); // Validate again immediately before mutation.
  const userId = currentUser();
  await Promise.all([waitForProfileSaves(), waitForSettingsSaves()]);
  if (currentUser() !== userId) throw new Error('Your session changed. Please try again.');
  const rebind = <T extends { userId: string }>(items: T[]) =>
    items.map((item) => ({ ...item, userId }));
  storage.replaceUser(userId, {
    // The Ghana Card status is never taken from a file: it stays as the review service set it.
    profile: safeProfile({
      ...normalizeProfile(userId, data.profile),
      ghanaCard: readProfile(userId).ghanaCard,
    }),
    records: rebind(data.records),
    momo: rebind(data.momo),
    diagnoses: rebind(data.diagnoses),
    chat: data.chat,
    settings: data.settings,
    ...keptData(userId),
  });
  resetAllStores();
  await loadAllStores(userId);
}

export async function deleteUserData(confirmation: string): Promise<void> {
  assertWritable();
  if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.');
  const userId = currentUser();
  await Promise.all([waitForProfileSaves(), waitForSettingsSaves()]);
  if (currentUser() !== userId) throw new Error('Your session changed. Please try again.');
  const kept = keptData(userId);
  storage.clearUser(userId);
  for (const [name, value] of Object.entries(kept)) storage.set(userKey(userId, name), value);
  resetAllStores();
  await loadAllStores(userId);
}
