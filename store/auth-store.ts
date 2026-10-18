import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import type { Session, StoreStatus } from '@/types';

interface AuthState {
  session: Session | null;
  status: StoreStatus;
  init: () => Promise<Session | null>;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (email: string, password: string) => Promise<Session>;
  continueAsGuest: () => Promise<Session>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  status: 'idle',

  init: async () => {
    set({ status: 'loading' });
    try {
      const session = await authService.getSession();
      set({ session, status: 'ready' });
      return session;
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },

  signIn: async (email, password) => {
    const session = await authService.signIn(email, password);
    set({ session, status: 'ready' });
    return session;
  },

  signUp: async (email, password) => {
    const session = await authService.signUp(email, password);
    set({ session, status: 'ready' });
    return session;
  },

  continueAsGuest: async () => {
    const session = await authService.continueAsGuest();
    set({ session, status: 'ready' });
    return session;
  },

  signOut: async () => {
    await authService.signOut();
    set({ session: null, status: 'ready' });
  },
}));
