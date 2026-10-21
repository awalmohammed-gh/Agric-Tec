// The farmer side of lending. Lenders and applications now live at platform level, where the
// admin console manages them (lenders.service, loan-applications.service).

import { readFarmerData } from '@/lib/admin/farmer-data';
import { calculateCreditScore } from '@/lib/calculations/credit-score';
import { configService } from '@/services/admin/config.service';
import { lendersService } from '@/services/admin/lenders.service';
import {
  loanApplicationsService,
  type LegacyApplication,
} from '@/services/admin/loan-applications.service';
import { storage, userKey } from '@/services/storage';
import type { LoanApplication, LoanApplicationInput } from '@/types';
import type { Lender } from '@/types/admin';

/** Where applications were stored per farmer before the admin console (phases 1–15). */
const legacyKey = (userId: string) => userKey(userId, 'loanApplications');

/**
 * Moves applications saved before the admin console into the platform list, once, so farmers
 * keep seeing them and admins can review them. The score is today's (the original wasn't kept).
 */
async function adoptLegacyApplications(userId: string): Promise<void> {
  const legacy = storage.get<LegacyApplication[]>(legacyKey(userId), []);
  if (legacy.length === 0 || storage.isReadOnly()) return;
  const data = readFarmerData(userId);
  const score = calculateCreditScore(
    data.records,
    data.momo,
    data.profile,
    await configService.getCreditConfig(),
  ).score;
  await loanApplicationsService.adoptLegacy(userId, legacy, score);
  storage.remove(legacyKey(userId));
}

export const loansService = {
  /** Active lenders only (the admin can switch lenders off). */
  async getPartners(): Promise<Lender[]> {
    return lendersService.list();
  },

  /** The farmer's applications with their status history, newest first. */
  async listApplications(userId: string): Promise<LoanApplication[]> {
    await adoptLegacyApplications(userId);
    return loanApplicationsService.listForFarmer(userId);
  },

  /** Sends an application to the lender. It starts as 'submitted' and the admin moves it on. */
  async submitApplication(
    userId: string,
    data: LoanApplicationInput,
    scoreAtApplication: number,
  ): Promise<LoanApplication> {
    return loanApplicationsService.create({ ...data, userId, scoreAtApplication });
  },
};
