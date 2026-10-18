import { create } from 'zustand';
import { defaultProfile, profileService } from '@/services/profile.service';
import type { Profile, StoreStatus } from '@/types';

interface ProfileState {
  userId: string | null;
  profile: Profile | null;
  status: StoreStatus;
  load: (userId: string) => Promise<void>;
  save: (partial: Partial<Omit<Profile, 'userId'>>) => Promise<Profile>;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
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

  save: async (partial) => {
    const { userId, profile } = get();
    if (!userId) throw new Error('You need to sign in first');
    const merged: Profile = { ...(profile ?? defaultProfile(userId)), ...partial, userId };
    const saved = await profileService.save(userId, merged);
    set({ profile: saved });
    return saved;
  },
}));
