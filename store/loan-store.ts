import { create } from 'zustand';
import { loansService } from '@/services/loans.service';
import { useAuthStore } from '@/store/auth-store';
import type { LoanApplication, LoanApplicationInput, StoreStatus } from '@/types';

export interface LoanDraft {
  amount: number;
  purpose: string;
  months: number;
  partnerId: string;
}

interface LoanState {
  userId: string | null;
  /** Submitted applications, newest first. */
  applications: LoanApplication[];
  status: StoreStatus;
  /**
   * The loan builder's current values, kept live so lender cards can price the same loan.
   * Null until the farmer enters a valid amount.
   */
  lastDraft: LoanDraft | null;
  /** When set, the apply-confirmation modal is open for this draft. */
  confirm: LoanDraft | null;
  load: (userId: string) => Promise<void>;
  setLastDraft: (draft: LoanDraft | null) => void;
  openConfirm: (draft: LoanDraft) => void;
  closeConfirm: () => void;
  submit: (input: LoanApplicationInput) => Promise<LoanApplication>;
}

export const useLoanStore = create<LoanState>()((set, get) => ({
  userId: null,
  applications: [],
  status: 'idle',
  lastDraft: null,
  confirm: null,

  load: async (userId) => {
    set({ userId, status: 'loading' });
    try {
      const applications = await loansService.listApplications(userId);
      if (get().userId !== userId) return;
      set({ applications, status: 'ready' });
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },

  setLastDraft: (lastDraft) => set({ lastDraft }),
  openConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),

  submit: async (input) => {
    const userId = useAuthStore.getState().session?.userId;
    if (!userId) throw new Error('You need to sign in first');
    const application = await loansService.submitApplication(userId, input);
    set((state) => ({ applications: [application, ...state.applications] }));
    return application;
  },
}));
