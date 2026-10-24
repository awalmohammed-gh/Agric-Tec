import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import {
  buildFarmerAccount,
  readFarmerData,
  readMeta,
  readUsers,
  writeMeta,
  writeUsers,
} from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { makeTempPassword } from '@/lib/admin/passwords';
import { calculateCreditScore, scoreLabel } from '@/lib/calculations/credit-score';
import { configService } from '@/services/admin/config.service';
import { toCSV } from '@/lib/export/csv';
import { generateId } from '@/lib/utils';
import { hashPassword, type StoredUser } from '@/services/auth.service';
import { delay, storage } from '@/services/storage';
import type { FarmerAccount, FarmerDetail } from '@/types/admin';

function findUser(id: string): StoredUser {
  const user = readUsers().find((u) => u.id === id);
  if (!user) throw new Error('Farmer not found.');
  return user;
}

function saveUser(updated: StoredUser): void {
  writeUsers(readUsers().map((u) => (u.id === updated.id ? updated : u)));
}

const label = (user: StoredUser) => readFarmerData(user.id).profile.name || user.email;

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

const actorName = () => getCurrentAdmin()?.name ?? 'Admin';

/** Lowercase, hyphenated, unique: "Pilot 2026" → "pilot-2026". */
const normalizeTags = (tags: string[]) =>
  [
    ...new Set(
      tags
        .map((t) =>
          t
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        )
        .filter(Boolean),
    ),
  ].slice(0, 10);

const statusSnapshot = (user: StoredUser) => ({
  status: user.status ?? 'active',
  suspendedReason: user.suspendedReason,
});

export const farmersService = {
  /** Every farmer account (including the guest) with their data summarised. */
  async list(): Promise<FarmerAccount[]> {
    await delay();
    requirePermission('farmers.view');
    return readUsers().map((user) => buildFarmerAccount(user));
  },

  /** Everything the quick view and profile page show: records, MoMo, score breakdown and rules. */
  async getDetail(id: string): Promise<FarmerDetail> {
    await delay();
    requirePermission('farmers.view');
    const user = findUser(id);
    const data = readFarmerData(id);
    const creditConfig = await configService.getCreditConfig();
    const newest = <T extends { date: string; createdAt: string }>(a: T, b: T) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    return {
      account: buildFarmerAccount(user, data),
      records: [...data.records].sort(newest),
      momo: [...data.momo].sort(newest),
      diagnoses: data.diagnoses,
      credit: calculateCreditScore(data.records, data.momo, data.profile, creditConfig),
      creditConfig,
    };
  },

  async get(id: string): Promise<FarmerAccount> {
    await delay();
    requirePermission('farmers.view');
    return buildFarmerAccount(findUser(id));
  },

  async suspend(id: string, reason: string): Promise<FarmerAccount> {
    await delay();
    const user = findUser(id);
    return withAudit(
      {
        permission: 'farmers.suspend',
        action: 'farmer.suspend',
        targetType: 'farmer',
        targetId: id,
        summary: `Suspended ${label(user)}: ${reason.trim()}`,
        before: statusSnapshot(user),
        after: (account) => ({ status: account.status, suspendedReason: account.suspendedReason }),
      },
      async () => {
        if (reason.trim().length < 3) throw new Error('Give a reason for the suspension.');
        if (user.status === 'suspended') throw new Error('This farmer is already suspended.');
        saveUser({ ...user, status: 'suspended', suspendedReason: reason.trim() });
        return buildFarmerAccount(findUser(id));
      },
    );
  },

  async reactivate(id: string): Promise<FarmerAccount> {
    await delay();
    const user = findUser(id);
    return withAudit(
      {
        permission: 'farmers.suspend',
        action: 'farmer.reactivate',
        targetType: 'farmer',
        targetId: id,
        summary: `Reactivated ${label(user)}`,
        before: statusSnapshot(user),
        after: (account) => ({ status: account.status }),
      },
      async () => {
        if (user.status !== 'suspended') throw new Error('This farmer is not suspended.');
        // undefined is dropped when stored, which clears the reason.
        saveUser({ ...user, status: 'active', suspendedReason: undefined });
        return buildFarmerAccount(findUser(id));
      },
    );
  },

  /**
   * Permanently deletes the farmer: their account, every "agrictec:<id>:*" key, and their
   * verifications (masked card + hash) and risk flags. Loan applications stay on record, shown as
   * "Farmer deleted": they hold no contact details, and lenders keep their history (phase A15).
   * `confirmation` must be their email or name.
   */
  async remove(id: string, confirmation: string): Promise<void> {
    await delay();
    const user = findUser(id);
    const data = readFarmerData(id);
    return withAudit(
      {
        permission: 'farmers.delete',
        action: 'farmer.delete',
        targetType: 'farmer',
        targetId: id,
        summary: `Permanently deleted ${label(user)}`,
        // A summary only: counts, never the farmer's data or contact details.
        before: {
          records: data.records.length,
          momo: data.momo.length,
          diagnoses: data.diagnoses.length,
          applications: storage
            .get<{ userId: string }[]>(PLATFORM_KEYS.loanApplications, [])
            .filter((a) => a.userId === id).length,
        },
        after: () => ({ deleted: true }),
      },
      async () => {
        const typed = confirmation.trim().toLowerCase();
        if (
          typed !== user.email.toLowerCase() &&
          typed !== data.profile.name.trim().toLowerCase()
        ) {
          throw new Error('Type the farmer’s email or name exactly to confirm.');
        }
        storage.clearUser(id);
        writeUsers(readUsers().filter((u) => u.id !== id));
        for (const key of [PLATFORM_KEYS.verifications, PLATFORM_KEYS.riskFlags]) {
          storage.set(
            key,
            storage.get<{ userId: string }[]>(key, []).filter((item) => item.userId !== id),
          );
        }
      },
    );
  },

  async addNote(id: string, text: string): Promise<FarmerAccount['adminNotes'][number]> {
    await delay();
    const user = findUser(id);
    return withAudit(
      {
        permission: 'farmers.edit',
        action: 'farmer.note',
        targetType: 'farmer',
        targetId: id,
        summary: `Added a note to ${label(user)}`,
      },
      async () => {
        if (!text.trim()) throw new Error('Write a note first.');
        if (text.length > 1000) throw new Error('Notes can be up to 1,000 characters.');
        const meta = readMeta(id);
        const note = {
          id: generateId(),
          text: text.trim(),
          by: actorName(),
          at: new Date().toISOString(),
        };
        writeMeta(id, { ...meta, adminNotes: [note, ...meta.adminNotes] });
        return note;
      },
    );
  },

  async setTags(id: string, tags: string[]): Promise<string[]> {
    await delay();
    const user = findUser(id);
    const meta = readMeta(id);
    const next = normalizeTags(tags);
    return withAudit(
      {
        permission: 'farmers.edit',
        action: 'farmer.tags',
        targetType: 'farmer',
        targetId: id,
        summary: `Set tags on ${label(user)}: ${next.join(', ') || 'none'}`,
        before: meta.tags,
      },
      async () => {
        writeMeta(id, { ...meta, tags: next });
        return next;
      },
    );
  },

  /** Sets a one-time password such as "Temp-48213" and returns it. It is never logged. */
  async resetPassword(id: string): Promise<string> {
    await delay();
    const user = findUser(id);
    return withAudit(
      {
        permission: 'farmers.edit',
        action: 'farmer.reset_password',
        targetType: 'farmer',
        targetId: id,
        summary: `Reset the password for ${label(user)}`,
        after: () => ({ reset: true }),
      },
      async () => {
        if (user.isGuest) throw new Error('The guest account has no password.');
        const temporary = makeTempPassword();
        saveUser({ ...user, passwordHash: await hashPassword(temporary) });
        return temporary;
      },
    );
  },

  /** One farmer's records as CSV (newest first). Only the count is logged. */
  async exportRecordsCSV(id: string): Promise<string> {
    await delay();
    const user = findUser(id);
    const records = [...readFarmerData(id).records].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    return withAudit(
      {
        permission: 'reports.export',
        action: 'farmer.export_records',
        targetType: 'farmer',
        targetId: id,
        summary: `Exported ${records.length} records of ${label(user)}`,
        after: () => ({ count: records.length }),
      },
      async () =>
        toCSV(records, [
          { header: 'Date', value: (r) => r.date },
          { header: 'Type', value: (r) => r.type },
          { header: 'Description', value: (r) => r.description },
          { header: 'Crop', value: (r) => r.crop },
          { header: 'Amount (GHS)', value: (r) => r.amount },
          { header: 'Notes', value: (r) => r.notes ?? '' },
        ]),
    );
  },

  /** CSV of the given farmers (or all). Only the count is logged, never the data. */
  async exportCSV(ids?: string[]): Promise<string> {
    await delay();
    const users = readUsers().filter((u) => !u.isGuest && (!ids || ids.includes(u.id)));
    const { bands } = await configService.getCreditConfig();
    return withAudit(
      {
        permission: 'reports.export',
        action: 'farmer.export',
        targetType: 'farmer',
        summary: `Exported ${users.length} farmer${users.length === 1 ? '' : 's'} to CSV`,
        after: () => ({ count: users.length }),
      },
      async () =>
        toCSV(
          users.map((u) => buildFarmerAccount(u)),
          // A whitelist: never the password hash, and never Ghana Card digits (only yes/no).
          [
            { header: 'ID', value: (f) => f.userId },
            { header: 'Name', value: (f) => f.profile.name },
            { header: 'Email', value: (f) => f.email },
            { header: 'Phone', value: (f) => f.profile.phone },
            { header: 'Region', value: (f) => f.profile.region },
            { header: 'Constituency', value: (f) => f.profile.constituency },
            { header: 'Community', value: (f) => f.profile.community ?? '' },
            { header: 'Farm', value: (f) => f.profile.farmName },
            { header: 'Farm type', value: (f) => f.profile.farmType },
            { header: 'Acres', value: (f) => f.profile.acres },
            { header: 'Primary crops', value: (f) => f.profile.primaryCrops.join('; ') },
            { header: 'GPS latitude', value: (f) => f.profile.gps?.lat ?? '' },
            { header: 'GPS longitude', value: (f) => f.profile.gps?.lng ?? '' },
            { header: 'Phone verified', value: (f) => yesNo(f.profile.verification.phone) },
            { header: 'Location verified', value: (f) => yesNo(f.profile.verification.location) },
            {
              header: 'Ghana Card verified',
              value: (f) => yesNo(f.profile.verification.ghanaCard),
            },
            // The status only: never a card number, not even the masked one.
            { header: 'Ghana Card status', value: (f) => f.profile.ghanaCard.status },
            { header: 'Status', value: (f) => f.status },
            { header: 'Suspension reason', value: (f) => f.suspendedReason ?? '' },
            { header: 'Credit score', value: (f) => f.stats.score },
            { header: 'Score band', value: (f) => scoreLabel(f.stats.score, bands) },
            { header: 'Records', value: (f) => f.stats.records },
            { header: 'MoMo transactions', value: (f) => f.stats.momo },
            { header: 'Diagnoses', value: (f) => f.stats.diagnoses },
            { header: 'Income (GHS)', value: (f) => f.stats.income },
            { header: 'Expenses (GHS)', value: (f) => f.stats.expenses },
            { header: 'Net profit (GHS)', value: (f) => f.stats.income - f.stats.expenses },
            { header: 'Tags', value: (f) => f.tags.join('; ') },
            { header: 'Joined', value: (f) => f.createdAt },
            { header: 'Last active', value: (f) => f.lastActiveAt ?? '' },
          ],
        ),
    );
  },
};
