import { getYear } from 'date-fns';
import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { readProfile } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { canTransition, LOAN_STATUS_LABELS } from '@/lib/admin/loan-status';
import { generateId } from '@/lib/utils';
import { lendersService } from '@/services/admin/lenders.service';
import { delay, storage } from '@/services/storage';
import type { LoanApplication, LoanApplicationFilter, LoanStatus } from '@/types/admin';

export interface NewLoanApplication {
  userId: string;
  partnerId: string;
  amount: number;
  months: number;
  purpose: string;
  monthly: number;
  scoreAtApplication: number;
}

const read = () => storage.get<LoanApplication[]>(PLATFORM_KEYS.loanApplications, []);
const write = (items: LoanApplication[]) => storage.set(PLATFORM_KEYS.loanApplications, items);

function find(id: string): LoanApplication {
  const app = read().find((a) => a.id === id);
  if (!app) throw new Error('Loan application not found.');
  return app;
}

/** "APP-2026-48213", unique among stored applications. */
function makeReference(existing: LoanApplication[]): string {
  const taken = new Set(existing.map((a) => a.reference));
  let reference = '';
  while (!reference || taken.has(reference)) {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    reference = `APP-${getYear(new Date())}-${10000 + (value % 90000)}`;
  }
  return reference;
}

export const loanApplicationsService = {
  /** Newest first. */
  async list(filter: LoanApplicationFilter = {}): Promise<LoanApplication[]> {
    await delay();
    requirePermission('loans.view');
    return read()
      .filter(
        (a) =>
          (!filter.status || a.status === filter.status) &&
          (!filter.partnerId || a.partnerId === filter.partnerId) &&
          (!filter.userId || a.userId === filter.userId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<LoanApplication> {
    await delay();
    requirePermission('loans.view');
    return find(id);
  },

  /** A farmer's own applications, newest first (called by the farmer app, so no admin check). */
  async listForFarmer(userId: string): Promise<LoanApplication[]> {
    await delay();
    return read()
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Called by the farmer app. The rate comes from the lender, which must be active. */
  async create(input: NewLoanApplication): Promise<LoanApplication> {
    await delay();
    const lender = (await lendersService.list()).find((l) => l.id === input.partnerId);
    if (!lender) throw new Error('This lender is not accepting applications right now.');
    if (!(input.amount > 0) || !(input.months > 0))
      throw new Error('Enter an amount and a period.');
    const existing = read();
    const now = new Date().toISOString();
    const app: LoanApplication = {
      id: generateId(),
      reference: makeReference(existing),
      userId: input.userId,
      partnerId: lender.id,
      amount: input.amount,
      months: input.months,
      purpose: input.purpose,
      rate: lender.rate,
      monthly: input.monthly,
      scoreAtApplication: input.scoreAtApplication,
      status: 'submitted',
      history: [{ status: 'submitted', by: readProfile(input.userId).name || 'Farmer', at: now }],
      createdAt: now,
    };
    write([app, ...existing]);
    return app;
  },

  /** Moves an application along the pipeline. Invalid jumps (e.g. submitted → disbursed) throw. */
  async updateStatus(id: string, status: LoanStatus, note?: string): Promise<LoanApplication> {
    await delay();
    const app = find(id);
    return withAudit(
      {
        permission: 'loans.manage',
        action: 'loan.status',
        targetType: 'loan',
        targetId: id,
        summary: `${app.reference}: ${LOAN_STATUS_LABELS[app.status]} → ${LOAN_STATUS_LABELS[status]}`,
        before: { status: app.status },
        after: (updated) => ({ status: updated.status, note: note?.trim() || undefined }),
      },
      async () => {
        if (!canTransition(app.status, status)) {
          throw new Error(
            `An application can’t move from ${LOAN_STATUS_LABELS[app.status]} to ${LOAN_STATUS_LABELS[status]}.`,
          );
        }
        const updated: LoanApplication = {
          ...app,
          status,
          history: [
            ...app.history,
            {
              status,
              by: getCurrentAdmin()?.name ?? 'Admin',
              at: new Date().toISOString(),
              ...(note?.trim() && { note: note.trim() }),
            },
          ],
        };
        write(read().map((a) => (a.id === id ? updated : a)));
        return updated;
      },
    );
  },
};
