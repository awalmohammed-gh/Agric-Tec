import { delay, storage, userKey } from '@/services/storage';
import type { Profile } from '@/types';

const key = (userId: string) => userKey(userId, 'profile');

export function defaultProfile(userId: string): Profile {
  return {
    userId,
    name: '',
    phone: '',
    email: '',
    region: 'Greater Accra',
    farmName: '',
    acres: 0,
    farmType: 'Smallholder',
    primaryCrops: [],
    verification: { phone: false, location: false, ghanaCard: false },
  };
}

export const profileService = {
  /** The saved profile, or a blank default one for new users. */
  async get(userId: string): Promise<Profile> {
    await delay();
    const saved = storage.get<Profile | null>(key(userId), null);
    return saved ? { ...defaultProfile(userId), ...saved, userId } : defaultProfile(userId);
  },

  async save(userId: string, profile: Profile): Promise<Profile> {
    await delay();
    const toSave: Profile = { ...profile, userId };
    storage.set(key(userId), toSave);
    return toSave;
  },
};
