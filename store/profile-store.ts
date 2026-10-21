import { create } from 'zustand';
import { isReadOnly, READ_ONLY_MESSAGE } from '@/lib/read-only';
import { defaultProfile, profileService } from '@/services/profile.service';
import type { Profile, StoreStatus } from '@/types';
import { ghanaPhone, normalizePhone } from '@/lib/profile';

export type ProfileUpdate = Partial<Omit<Profile, 'userId' | 'verification'>> & {
  verification?: Partial<Profile['verification']>;
};
let saveQueue: Promise<unknown> = Promise.resolve();
export async function waitForProfileSaves(): Promise<void> {
  await saveQueue.catch(() => {});
}

interface ProfileState {
  userId: string | null;
  profile: Profile | null;
  status: StoreStatus;
  load: (userId: string) => Promise<void>;
  save: (partial: ProfileUpdate) => Promise<Profile>;
  verifyPhone: (expectedPhone: string) => Promise<Profile>;
}

export const useProfileStore = create<ProfileState>()((set, get) => {
  function persist(partial: ProfileUpdate, expectedPhone?: string): Promise<Profile> {
    if (isReadOnly()) return Promise.reject(new Error(READ_ONLY_MESSAGE));
    const userId = get().userId;
    if (!userId) return Promise.reject(new Error('You need to sign in first'));
    const operation = saveQueue
      .catch(() => {})
      .then(async () => {
        if (get().userId !== userId) throw new Error('Your session changed. Please try again.');
        const current = get().profile ?? defaultProfile(userId);
        if (
          expectedPhone !== undefined &&
          (current.phone !== expectedPhone || !ghanaPhone.test(current.phone))
        )
          throw new Error('Your phone number changed. Send a new code.');
        const phone = normalizePhone(partial.phone ?? current.phone);
        const phoneChanged = normalizePhone(current.phone) !== phone;
        const merged: Profile = {
          ...current,
          ...partial,
          userId,
          phone,
          verification: {
            ...current.verification,
            ...partial.verification,
            ...(phoneChanged && { phone: false }),
          },
        };
        const saved = await profileService.save(userId, merged);
        if (get().userId === userId) set({ profile: saved });
        return saved;
      });
    saveQueue = operation;
    return operation;
  }
  return {
    userId: null,
    profile: null,
    status: 'idle',

    load: async (userId) => {
      set({ userId, status: 'loading' });
      try {
        const profile = await profileService.get(userId);
        if (get().userId !== userId) return;
        set({ profile, status: 'ready' });
      } catch (error) {
        set({ status: 'error' });
        throw error;
      }
    },

    save: (partial) => persist(partial),
    verifyPhone: (phone) => persist({ verification: { phone: true } }, phone),
  };
});
