import { getYear } from 'date-fns';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { generateId } from '@/lib/utils';
import { delay, storage, userKey } from '@/services/storage';
import type { LoanApplication, LoanApplicationInput, LoanPartner } from '@/types';

const key = (userId: string) => userKey(userId, 'loanApplications');

/** e.g. "APP-2026-48213" */
function makeReference(): string {
  const digits = 10000 + Math.floor(Math.random() * 90000);
  return `APP-${getYear(new Date())}-${digits}`;
}

export const loansService = {
  async getPartners(): Promise<LoanPartner[]> {
    await delay();
    return LOAN_PARTNERS;
  },

  async submitApplication(userId: string, data: LoanApplicationInput): Promise<LoanApplication> {
    await delay();
    const application: LoanApplication = {
      ...data,
      id: generateId(),
      userId,
      reference: makeReference(),
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
    storage.set(key(userId), [application, ...storage.get<LoanApplication[]>(key(userId), [])]);
    return application;
  },
};
