import { create } from 'zustand';
import { sessionStore } from '@/services/storage';

const IMPERSONATION_KEY = 'admin-impersonation';

/** The farmer an admin is viewing the app as (read-only, phase A8). */
export interface Impersonation {
  userId: string;
  name: string;
}

interface AdminUiState {
  /** The sidebar drawer below 1024px. */
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  /** The Ctrl/⌘+K search palette. */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** The change-password dialog from the user menu. */
  changePasswordOpen: boolean;
  setChangePasswordOpen: (open: boolean) => void;
  /** Kept for this browser tab only, so a reload doesn't silently drop it. */
  impersonating: Impersonation | null;
  startImpersonation: (target: Impersonation) => void;
  stopImpersonation: () => void;
}

/** UI-only state for the admin console (nothing here is platform data). */
export const useAdminUiStore = create<AdminUiState>()((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),

  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  changePasswordOpen: false,
  setChangePasswordOpen: (changePasswordOpen) => set({ changePasswordOpen }),

  // sessionStore is SSR-safe (returns the fallback on the server).
  impersonating: sessionStore.get<Impersonation | null>(IMPERSONATION_KEY, null),
  startImpersonation: (target) => {
    sessionStore.set(IMPERSONATION_KEY, target);
    set({ impersonating: target });
  },
  stopImpersonation: () => {
    sessionStore.set(IMPERSONATION_KEY, null);
    set({ impersonating: null });
  },
}));
