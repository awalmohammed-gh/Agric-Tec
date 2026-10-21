import { REGIONS } from '@/constants/regions';
import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import {
  buildFarmerAccount,
  readFarmerData,
  readMeta,
  readUsers,
  writeMeta,
  writeProfile,
  writeUsers,
} from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { makeTempPassword } from '@/lib/admin/passwords';
import { toCSV } from '@/lib/export/csv';
import { generateId } from '@/lib/utils';
import { hashPassword, type StoredUser } from '@/services/auth.service';
import { delay, storage } from '@/services/storage';
import type { Profile } from '@/types';
import type { FarmerAccount } from '@/types/admin';

/** Profile fields an admin may edit. Verification changes go through verifications.service. */
export type FarmerProfilePatch = Partial<
  Pick<
    Profile,
    'name' | 'phone' | 'email' | 'region' | 'farmName' | 'acres' | 'farmType' | 'primaryCrops'
  >
>;

function findUser(id: string): StoredUser {
  const user = readUsers().find((u) => u.id === id);
  if (!user) throw new Error('Farmer not found.');
  return user;
}

function saveUser(updated: StoredUser): void {
  writeUsers(readUsers().map((u) => (u.id === updated.id ? updated : u)));
}

const label = (user: StoredUser) => readFarmerData(user.id).profile.name || user.email;

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

  async get(id: string): Promise<FarmerAccount> {
    await delay();
    requirePermission('farmers.view');
    return buildFarmerAccount(findUser(id));
  },

  async updateProfile(id: string, patch: FarmerProfilePatch): Promise<FarmerAccount> {
    await delay();
    const user = findUser(id);
    const profile = readFarmerData(id).profile;
    const fields = Object.keys(patch) as (keyof FarmerProfilePatch)[];
    return withAudit(
      {
        permission: 'farmers.edit',
        action: 'farmer.update',
        targetType: 'farmer',
        targetId: id,
        summary: `Edited ${fields.join(', ')} for ${label(user)}`,
        before: Object.fromEntries(fields.map((f) => [f, profile[f]])),
        after: (account) => Object.fromEntries(fields.map((f) => [f, account.profile[f]])),
      },
      async () => {
        if (patch.name !== undefined && !patch.name.trim()) throw new Error('Name is required.');
        if (patch.region !== undefined && !REGIONS.includes(patch.region)) {
          throw new Error('Choose a valid region.');
        }
        if (patch.acres !== undefined && (!Number.isFinite(patch.acres) || patch.acres < 0)) {
          throw new Error('Acres must be zero or more.');
        }
        writeProfile({ ...profile, ...patch, userId: id });
        return buildFarmerAccount(findUser(id));
      },
    );
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
   * verifications, applications and risk flags. `confirmation` must be their email or name.
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
        before: {
          email: user.email,
          name: data.profile.name,
          records: data.records.length,
          momo: data.momo.length,
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
        for (const key of [
          PLATFORM_KEYS.verifications,
          PLATFORM_KEYS.loanApplications,
          PLATFORM_KEYS.riskFlags,
        ]) {
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

  /** CSV of the given farmers (or all). Only the count is logged, never the data. */
  async exportCSV(ids?: string[]): Promise<string> {
    await delay();
    const users = readUsers().filter((u) => !ids || ids.includes(u.id));
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
          [
            { header: 'ID', value: (f) => f.userId },
            { header: 'Name', value: (f) => f.profile.name },
            { header: 'Email', value: (f) => f.email },
            { header: 'Phone', value: (f) => f.profile.phone },
            { header: 'Region', value: (f) => f.profile.region },
            { header: 'Farm', value: (f) => f.profile.farmName },
            { header: 'Farm type', value: (f) => f.profile.farmType },
            { header: 'Acres', value: (f) => f.profile.acres },
            { header: 'Primary crops', value: (f) => f.profile.primaryCrops.join('; ') },
            { header: 'Status', value: (f) => f.status },
            { header: 'Credit score', value: (f) => f.stats.score },
            { header: 'Records', value: (f) => f.stats.records },
            { header: 'MoMo', value: (f) => f.stats.momo },
            { header: 'Income (GHS)', value: (f) => f.stats.income },
            { header: 'Expenses (GHS)', value: (f) => f.stats.expenses },
            { header: 'Tags', value: (f) => f.tags.join('; ') },
            { header: 'Joined', value: (f) => f.createdAt },
            { header: 'Last active', value: (f) => f.lastActiveAt ?? '' },
          ],
        ),
    );
  },
};
