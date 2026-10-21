import { create } from 'zustand';
import { assertWritable } from '@/lib/read-only';
import {
  DEFAULT_ASSISTANT_KB,
  DEFAULT_CREDIT_CONFIG,
  DEFAULT_CROP_CONTENT,
  DEFAULT_DIAGNOSES,
  DEFAULT_FLAGS,
  DEFAULT_LENDERS,
  DEFAULT_MARKET_PRICES,
  DEFAULT_PLANS,
} from '@/lib/admin/defaults';
import { platformService, type PlatformSnapshot } from '@/services/platform.service';
import { useAuthStore } from '@/store/auth-store';
import type { StoreStatus } from '@/types';
import type { FeatureFlags, VerificationRequest } from '@/types/admin';

interface PlatformState extends PlatformSnapshot {
  userId: string | null;
  status: StoreStatus;
  /** Flags can load on their own (login and signup pages) before the rest. */
  flagsStatus: StoreStatus;
  /** Announcement IDs this farmer dismissed. */
  dismissed: string[];
  /** This farmer's verification requests, newest first. */
  verifications: VerificationRequest[];
  loadFlags: () => Promise<FeatureFlags>;
  load: (userId: string) => Promise<void>;
  dismissAnnouncement: (id: string) => Promise<void>;
  submitGhanaCard: (cardNumber: string) => Promise<VerificationRequest>;
  logInstantCheck: (kind: 'phone' | 'location', value: string) => Promise<void>;
}

/**
 * Starts with the built-in defaults, which equal the admin's defaults. Until the platform loads
 * (and in tests), the farmer app behaves exactly as it did before the admin console existed.
 */
export const initialPlatformState = (): Omit<
  PlatformState,
  'loadFlags' | 'load' | 'dismissAnnouncement' | 'submitGhanaCard' | 'logInstantCheck'
> => ({
  userId: null,
  status: 'idle',
  flagsStatus: 'idle',
  creditConfig: DEFAULT_CREDIT_CONFIG,
  flags: DEFAULT_FLAGS,
  plans: DEFAULT_PLANS,
  lenders: DEFAULT_LENDERS,
  allLenders: DEFAULT_LENDERS,
  marketPrices: DEFAULT_MARKET_PRICES,
  weatherOverride: null,
  crops: DEFAULT_CROP_CONTENT,
  knowledge: DEFAULT_ASSISTANT_KB,
  diagnoses: DEFAULT_DIAGNOSES,
  announcements: [],
  dismissed: [],
  verifications: [],
});

function currentUser(): string {
  const id = useAuthStore.getState().session?.userId;
  if (!id) throw new Error('You need to sign in first');
  return id;
}

export const usePlatformStore = create<PlatformState>()((set, get) => ({
  ...initialPlatformState(),

  loadFlags: async () => {
    set({ flagsStatus: 'loading' });
    try {
      const flags = await platformService.getFlags();
      set({ flags, flagsStatus: 'ready' });
      return flags;
    } catch (error) {
      set({ flagsStatus: 'error' });
      throw error;
    }
  },

  load: async (userId) => {
    set({ userId, status: 'loading' });
    try {
      const [snapshot, dismissed, verifications] = await Promise.all([
        platformService.load(),
        platformService.getDismissed(userId),
        platformService.listVerifications(userId),
      ]);
      if (get().userId !== userId) return;
      set({ ...snapshot, dismissed, verifications, status: 'ready', flagsStatus: 'ready' });
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },

  dismissAnnouncement: async (id) => {
    assertWritable();
    const userId = currentUser();
    // Hide it at once; storage follows.
    set((state) => ({ dismissed: [...state.dismissed, id] }));
    const dismissed = await platformService.dismiss(
      userId,
      id,
      get().announcements.map((a) => a.id),
    );
    if (get().userId === userId) set({ dismissed });
  },

  submitGhanaCard: async (cardNumber) => {
    assertWritable();
    const userId = currentUser();
    const request = await platformService.submitGhanaCard(userId, cardNumber);
    if (get().userId === userId) {
      set((state) => ({ verifications: [request, ...state.verifications] }));
    }
    return request;
  },

  logInstantCheck: async (kind, value) => {
    assertWritable();
    const userId = currentUser();
    const request = await platformService.logInstantCheck(userId, kind, value);
    if (get().userId === userId) {
      set((state) => ({ verifications: [request, ...state.verifications] }));
    }
  },
}));
