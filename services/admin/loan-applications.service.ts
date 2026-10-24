import { getYear } from 'date-fns';
import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { readProfile, readUsers } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { statusChangeSchema, type StatusChangeInput } from '@/lib/admin/loan-pipeline';
import { LOAN_STATUS_LABELS } from '@/lib/admin/loan-status';
import { parseOrThrow } from '@/lib/admin/schemas';
import { toCSV } from '@/lib/export/csv';
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

/** An application as the farmer app stored it before the admin console (phases 1–15). */
export interface LegacyApplication {
  id: string;
  userId: string;
  reference: string;
  partnerId: string;
  amount: number;
  months: number;
  purpose: string;
  monthly: number;
  createdAt: string;
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

  /** False once the farmer's account was permanently deleted (the application stays on record). */
  async farmerExists(userId: string): Promise<boolean> {
    await delay(0);
    requirePermission('loans.view');
    return readUsers().some((u) => u.id === userId);
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

  /**
   * One-time move of applications a farmer saved before the admin console existed. They join
   * the pipeline as submitted. Applications already on the platform (same ID) are skipped.
   */
  async adoptLegacy(
    userId: string,
    legacy: LegacyApplication[],
    scoreAtApplication: number,
  ): Promise<void> {
    const existing = read();
    const known = new Set(existing.map((a) => a.id));
    const lenders = await lendersService.list({ includeInactive: true });
    const by = readProfile(userId).name || 'Farmer';
    const adopted = legacy
      .filter((old) => !known.has(old.id))
      .map((old): LoanApplication => ({
        id: old.id,
        reference: old.reference,
        userId,
        partnerId: old.partnerId,
        amount: old.amount,
        months: old.months,
        purpose: old.purpose,
        rate: lenders.find((l) => l.id === old.partnerId)?.rate ?? 0,
        monthly: old.monthly,
        scoreAtApplication,
        status: 'submitted',
        history: [{ status: 'submitted', by, at: old.createdAt }],
        createdAt: old.createdAt,
      }));
    if (adopted.length) write([...adopted, ...existing]);
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

  /**
   * Moves an application along the pipeline (the farmer's timeline shows the new step at once).
   * Invalid jumps (e.g. submitted → disbursed) throw; approved, rejected and defaulted need a
   * note; disbursed needs the date and the transfer reference. `input` may be just the note.
   */
  async updateStatus(
    id: string,
    status: LoanStatus,
    input: string | StatusChangeInput = {},
  ): Promise<LoanApplication> {
    await delay();
    const app = find(id);
    const details = typeof input === 'string' ? { note: input } : input;
    return withAudit(
      {
        permission: 'loans.manage',
        action: 'loan.status',
        targetType: 'loan',
        targetId: id,
        summary: `${app.reference}: ${LOAN_STATUS_LABELS[app.status]} → ${LOAN_STATUS_LABELS[status]}`,
        before: { status: app.status },
        after: (updated) => {
          const step = updated.history.at(-1);
          return {
            status: updated.status,
            note: step?.note,
            disbursedOn: step?.disbursedOn,
            disbursementRef: step?.disbursementRef,
          };
        },
      },
      async () => {
        const farmerDeleted = !readUsers().some((u) => u.id === app.userId);
        const valid = parseOrThrow(
          statusChangeSchema(app, status, new Date(), farmerDeleted),
          details,
        );
        const note = valid.note?.trim();
        const disbursed = status === 'disbursed';
        const updated: LoanApplication = {
          ...app,
          status,
          history: [
            ...app.history,
            {
              status,
              by: getCurrentAdmin()?.name ?? 'Admin',
              at: new Date().toISOString(),
              ...(note && { note }),
              ...(disbursed && {
                disbursedOn: valid.disbursedOn,
                disbursementRef: valid.disbursementRef?.trim(),
              }),
            },
          ],
          ...(disbursed && {
            disbursement: {
              date: valid.disbursedOn ?? '',
              reference: valid.disbursementRef?.trim() ?? '',
            },
          }),
        };
        write(read().map((a) => (a.id === id ? updated : a)));
        return updated;
      },
    );
  },

  /** The applications (all, or these IDs) as CSV. No farmer contact details. Audited. */
  async exportCSV(ids?: string[]): Promise<string> {
    await delay();
    const apps = read()
      .filter((a) => !ids || ids.includes(a.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lenders = await lendersService.list({ includeInactive: true });
    return withAudit(
      {
        permission: 'reports.export',
        action: 'loan.export',
        targetType: 'loan',
        summary: `Exported ${apps.length} loan application${apps.length === 1 ? '' : 's'} to CSV`,
        after: () => ({ count: apps.length }),
      },
      async () =>
        toCSV(apps, [
          { header: 'Reference', value: (a) => a.reference },
          { header: 'Farmer', value: (a) => readProfile(a.userId).name },
          { header: 'Region', value: (a) => readProfile(a.userId).region },
          { header: 'Lender', value: (a) => lenders.find((l) => l.id === a.partnerId)?.name ?? '' },
          { header: 'Amount (GHS)', value: (a) => a.amount },
          { header: 'Purpose', value: (a) => a.purpose },
          { header: 'Months', value: (a) => a.months },
          { header: 'Rate (%)', value: (a) => a.rate },
          { header: 'Monthly (GHS)', value: (a) => a.monthly },
          { header: 'Score at application', value: (a) => a.scoreAtApplication },
          { header: 'Status', value: (a) => LOAN_STATUS_LABELS[a.status] },
          { header: 'Sent', value: (a) => a.createdAt.slice(0, 10) },
          { header: 'Disbursed on', value: (a) => a.disbursement?.date ?? '' },
        ]),
    );
  },
};
