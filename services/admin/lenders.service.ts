import { withAudit } from '@/lib/admin/audit';
import { DEFAULT_LENDERS } from '@/lib/admin/defaults';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { deactivateBlock, deleteBlock } from '@/lib/admin/loan-pipeline';
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

const applications = () => storage.get<LoanApplication[]>(PLATFORM_KEYS.loanApplications, []);

/** Same name, ignoring case and extra spaces. */
const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

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
        if (lenders.some((l) => sameName(l.name, valid.name))) {
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
        if (read().some((l) => l.id !== id && sameName(l.name, valid.name))) {
          throw new Error('A lender with this name already exists.');
        }
        // Switching a lender off through an edit follows the same rule as the toggle.
        if (lender.active && !valid.active) {
          const blocked = deactivateBlock(lender, applications());
          if (blocked) throw new Error(blocked);
        }
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
        // Hidden from farmers at once, so not while applications are under review.
        const blocked = deactivateBlock(lender, applications());
        if (blocked) throw new Error(blocked);
        const updated = { ...lender, active: !lender.active };
        write(read().map((l) => (l.id === id ? updated : l)));
        return updated;
      },
    );
  },

  /** Only a lender with no applications at all can be deleted: deactivate it instead. */
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
        const blocked = deleteBlock(lender, applications());
        if (blocked) throw new Error(blocked);
        write(read().filter((l) => l.id !== id));
      },
    );
  },
};
