import { create } from 'zustand';
import { adminAuthService, type SignOutReason } from '@/services/admin/admin-auth.service';
import type { StoreStatus } from '@/types';
import type { AdminUser } from '@/types/admin';

/** How often activity is written to storage (it is checked every second, but saved sparingly). */
export const TOUCH_THROTTLE_MS = 30_000;

interface AdminAuthState {
  /** The signed-in admin (id, name, email, role…). Null when signed out. */
  admin: AdminUser | null;
  startedAt: string | null;
  /** Last activity seen in this tab (ms). The session timeout counts from here. */
  lastActivityAt: number | null;
  status: StoreStatus;
  /** Loads the session. `expired` is true when it just ended for inactivity. */
  init: () => Promise<{ admin: AdminUser | null; expired: boolean }>;
  signIn: (email: string, password: string) => Promise<AdminUser>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<AdminUser>;
  /** Saves the signed-in admin's own display name. */
  updateName: (name: string) => Promise<AdminUser>;
  /** Marks activity now. Saved to storage at most once every 30 seconds, unless `force`. */
  touch: (force?: boolean) => void;
}

let lastSaved = 0;

export const useAdminAuthStore = create<AdminAuthState>()((set) => ({
  admin: null,
  startedAt: null,
  lastActivityAt: null,
  status: 'idle',

  init: async () => {
    set({ status: 'loading' });
    try {
      const { session, expired } = await adminAuthService.sessionState();
      set({
        admin: session?.admin ?? null,
        startedAt: session?.startedAt ?? null,
        lastActivityAt: session ? Date.now() : null,
        status: 'ready',
      });
      if (session) {
        lastSaved = Date.now();
        void adminAuthService.touch();
      }
      return { admin: session?.admin ?? null, expired };
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },

  signIn: async (email, password) => {
    const session = await adminAuthService.signIn(email, password);
    lastSaved = Date.now();
    set({
      admin: session.admin,
      startedAt: session.startedAt,
      lastActivityAt: Date.now(),
      status: 'ready',
    });
    return session.admin;
  },

  signOut: async (reason = 'manual') => {
    await adminAuthService.signOut(reason);
    set({ admin: null, startedAt: null, lastActivityAt: null, status: 'ready' });
  },

  changePassword: async (currentPassword, nextPassword) => {
    const admin = await adminAuthService.changePassword(currentPassword, nextPassword);
    set({ admin });
    return admin;
  },

  updateName: async (name) => {
    const admin = await adminAuthService.updateName(name);
    set({ admin });
    return admin;
  },

  touch: (force = false) => {
    const now = Date.now();
    set({ lastActivityAt: now });
    if (force || now - lastSaved >= TOUCH_THROTTLE_MS) {
      lastSaved = now;
      void adminAuthService.touch();
    }
  },
}));
