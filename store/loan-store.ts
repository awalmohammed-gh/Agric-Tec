import { create } from 'zustand';
import { loansService } from '@/services/loans.service';
import { useAuthStore } from '@/store/auth-store';
import type { LoanApplication, LoanApplicationInput } from '@/types';

export interface LoanDraft {
  amount: number;
  purpose: string;
  months: number;
  partnerId: string;
}

interface LoanState {
  /** The last values checked in the application form (used to pre-fill lender cards). */
  lastDraft: LoanDraft | null;
  /** When set, the apply-confirmation modal is open for this draft. */
  confirm: LoanDraft | null;
  setLastDraft: (draft: LoanDraft) => void;
  openConfirm: (draft: LoanDraft) => void;
  closeConfirm: () => void;
  submit: (input: LoanApplicationInput) => Promise<LoanApplication>;
}

export const useLoanStore = create<LoanState>()((set) => ({
  lastDraft: null,
  confirm: null,
  setLastDraft: (lastDraft) => set({ lastDraft }),
  openConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),

  submit: async (input) => {
    const userId = useAuthStore.getState().session?.userId;
    if (!userId) throw new Error('You need to sign in first');
    return loansService.submitApplication(userId, input);
  },
}));
