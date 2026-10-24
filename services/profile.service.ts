import { delay, storage, userKey } from '@/services/storage';
import type { Profile } from '@/types';
import { defaultProfile, normalizeProfile, safeProfile } from '@/lib/profile';

const key = (userId: string) => userKey(userId, 'profile');

export { defaultProfile };

export const profileService = {
  /** The saved profile (older saves upgraded), or a blank default one for new users. */
  async get(userId: string): Promise<Profile> {
    await delay();
    return normalizeProfile(
      userId,
      storage.get<Parameters<typeof normalizeProfile>[1]>(key(userId), null),
    );
  },

  async save(userId: string, profile: Profile): Promise<Profile> {
    await delay();
    const toSave = safeProfile({ ...profile, userId });
    storage.set(key(userId), toSave);
    if (
      typeof window !== 'undefined' &&
      JSON.stringify(storage.get<Profile | null>(key(userId), null)) !== JSON.stringify(toSave)
    ) {
      throw new Error('Could not save your profile. Check your device storage and try again.');
    }
    return toSave;
  },
};
