import { withAudit } from '@/lib/admin/audit';
import { DEFAULT_LENDERS } from '@/lib/admin/defaults';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { OPEN_LOAN_STATUSES } from '@/lib/admin/loan-status';
import { lenderInputSchema, parseOrThrow } from '@/lib/admin/schemas';
import { delay, storage } from '@/services/storage';
import type { Lender, LenderInput, LoanApplication } from '@/types/admin';

const read = () => storage.get<Lender[]>(PLATFORM_KEYS.lenders, DEFAULT_LENDERS);
const write = (items: Lender[]) => storage.set(PLATFORM_KEYS.lenders, items);

function find(id: string): Lender {
  const lender = read().find((l) => l.id === id);
  if (!lender) throw new Error('Lender not found.');
  return lender;
}

/** "Sinapi Aba Trust" → "sinapi-aba-trust", with a number added if taken. */
function makeId(name: string, taken: Lender[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'lender';
  let id = base;
  for (let n = 2; taken.some((l) => l.id === id); n++) id = `${base}-${n}`;
  return id;
}

const openApplications = (lenderId: string) =>
  storage
    .get<LoanApplication[]>(PLATFORM_KEYS.loanApplications, [])
    .filter((a) => a.partnerId === lenderId && OPEN_LOAN_STATUSES.includes(a.status)).length;

export const lendersService = {
  /** Active lenders only, unless `includeInactive`. Read by the farmer app, so no admin check. */
  async list({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<Lender[]> {
    await delay();
    return read().filter((l) => includeInactive || l.active);
  },

  async create(input: LenderInput): Promise<Lender> {
    await delay();
    return withAudit(
      {
        permission: 'lenders.manage',
        action: 'lender.create',
        targetType: 'lender',
        targetId: (lender) => lender.id,
        summary: `Added lender ${input.name.trim()}`,
      },
      async () => {
        const valid = parseOrThrow(lenderInputSchema, input);
        const lenders = read();
        if (lenders.some((l) => l.name.toLowerCase() === valid.name.toLowerCase())) {
          throw new Error('A lender with this name already exists.');
        }
        const lender: Lender = {
          ...valid,
          id: makeId(valid.name, lenders),
          createdAt: new Date().toISOString(),
        };
        write([...lenders, lender]);
        return lender;
      },
    );
  },

  async update(id: string, patch: Partial<LenderInput>): Promise<Lender> {
    await delay();
    const lender = find(id);
    return withAudit(
      {
        permission: 'lenders.manage',
        action: 'lender.update',
        targetType: 'lender',
        targetId: id,
        summary: `Edited lender ${lender.name}`,
        before: lender,
      },
      async () => {
        // The schema strips id/createdAt from the merged object; they are re-added unchanged.
        const valid = parseOrThrow(lenderInputSchema, { ...lender, ...patch });
        const updated: Lender = { ...valid, id, createdAt: lender.createdAt };
        write(read().map((l) => (l.id === id ? updated : l)));
        return updated;
      },
    );
  },

  async toggleActive(id: string): Promise<Lender> {
    await delay();
    const lender = find(id);
    return withAudit(
      {
        permission: 'lenders.manage',
        action: lender.active ? 'lender.deactivate' : 'lender.activate',
        targetType: 'lender',
        targetId: id,
        summary: `${lender.active ? 'Deactivated' : 'Activated'} lender ${lender.name}`,
        before: { active: lender.active },
        after: (updated) => ({ active: updated.active }),
      },
      async () => {
        const updated = { ...lender, active: !lender.active };
        write(read().map((l) => (l.id === id ? updated : l)));
        return updated;
      },
    );
  },

  /** Blocked while the lender has applications in progress: deactivate it instead. */
  async remove(id: string): Promise<void> {
    await delay();
    const lender = find(id);
    return withAudit(
      {
        permission: 'lenders.manage',
        action: 'lender.delete',
        targetType: 'lender',
        targetId: id,
        summary: `Removed lender ${lender.name}`,
        before: lender,
        after: () => ({ deleted: true }),
      },
      async () => {
        const open = openApplications(id);
        if (open > 0) {
          throw new Error(
            `${lender.name} has ${open} open application${open === 1 ? '' : 's'}. Deactivate it instead.`,
          );
        }
        write(read().filter((l) => l.id !== id));
      },
    );
  },
};
