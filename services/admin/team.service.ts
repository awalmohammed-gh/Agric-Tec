import {
  getCurrentAdmin,
  readAdmins,
  requirePermission,
  toAdminUser,
  writeAdmins,
  type StoredAdmin,
} from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { readUsers } from '@/lib/admin/farmer-data';
import { makeTempPassword } from '@/lib/admin/passwords';
import { canManageRole, ROLE_LABELS, ROLE_RANK } from '@/lib/admin/permissions';
import { generateId } from '@/lib/utils';
import { hashPassword } from '@/services/auth.service';
import { delay } from '@/services/storage';
import type { AdminRole, AdminUser } from '@/types/admin';

export interface InviteResult {
  admin: AdminUser;
  /** Shown once to the inviter; never stored or logged in plain text. */
  temporaryPassword: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_SUPER_ADMIN = 'There must always be at least one active Super Admin.';

function find(id: string): StoredAdmin {
  const admin = readAdmins().find((a) => a.id === id);
  if (!admin) throw new Error('Team member not found.');
  return admin;
}

const save = (updated: StoredAdmin) =>
  writeAdmins(readAdmins().map((a) => (a.id === updated.id ? updated : a)));

const activeSuperAdmins = () =>
  readAdmins().filter((a) => a.role === 'super_admin' && a.status === 'active').length;

/** Admins act on others here; changes to yourself go through your own account settings. */
function notSelf(id: string): void {
  if (getCurrentAdmin()?.id === id) {
    throw new Error('You can’t change your own access. Ask another Super Admin.');
  }
}

export const teamService = {
  /** Highest role first, then by name. */
  async list(): Promise<AdminUser[]> {
    await delay();
    requirePermission('admins.manage');
    return readAdmins()
      .map(toAdminUser)
      .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.name.localeCompare(b.name));
  },

  /** Creates the account with a temporary password the new admin must change at first login. */
  async invite(name: string, email: string, role: AdminRole): Promise<InviteResult> {
    await delay();
    return withAudit(
      {
        permission: 'admins.manage',
        action: 'admin.invite',
        targetType: 'admin',
        targetId: (result) => result.admin.id,
        summary: `Invited ${name.trim()} as ${ROLE_LABELS[role]}`,
        after: (result) => result.admin,
      },
      async () => {
        const actor = getCurrentAdmin()!;
        if (!canManageRole(actor.role, role))
          throw new Error('Only a Super Admin can add team members.');
        const normalized = email.trim().toLowerCase();
        if (name.trim().length < 2) throw new Error('Enter the team member’s full name.');
        if (!EMAIL.test(normalized)) throw new Error('Enter a valid email address.');
        if (readAdmins().some((a) => a.email === normalized)) {
          throw new Error('A team member with this email already exists.');
        }
        // Staff and farmer sign-ins are separate: one email is never both.
        if (readUsers().some((u) => !u.isGuest && u.email === normalized)) {
          throw new Error(
            'This email belongs to a farmer account. Use a different email for staff.',
          );
        }
        const temporaryPassword = makeTempPassword();
        const stored: StoredAdmin = {
          id: generateId(),
          name: name.trim(),
          email: normalized,
          role,
          status: 'active',
          mustChangePassword: true,
          createdAt: new Date().toISOString(),
          createdBy: actor.id,
          passwordHash: await hashPassword(temporaryPassword),
        };
        writeAdmins([...readAdmins(), stored]);
        return { admin: toAdminUser(stored), temporaryPassword };
      },
    );
  },

  async changeRole(id: string, role: AdminRole): Promise<AdminUser> {
    await delay();
    const target = find(id);
    return withAudit(
      {
        permission: 'admins.manage',
        action: 'admin.role',
        targetType: 'admin',
        targetId: id,
        summary: `Changed ${target.name} from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[role]}`,
        before: { role: target.role },
        after: (updated) => ({ role: updated.role }),
      },
      async () => {
        notSelf(id);
        const actor = getCurrentAdmin()!;
        if (target.role === role)
          throw new Error(`${target.name} is already ${ROLE_LABELS[role]}.`);
        if (
          !canManageRole(actor.role, target.role, {
            nextRole: role,
            activeSuperAdmins: activeSuperAdmins(),
          })
        ) {
          throw new Error(LAST_SUPER_ADMIN);
        }
        const updated = { ...target, role };
        save(updated);
        return toAdminUser(updated);
      },
    );
  },

  async disable(id: string): Promise<AdminUser> {
    await delay();
    const target = find(id);
    return withAudit(
      {
        permission: 'admins.manage',
        action: 'admin.disable',
        targetType: 'admin',
        targetId: id,
        summary: `Disabled ${target.name}`,
        before: { status: target.status },
        after: (updated) => ({ status: updated.status }),
      },
      async () => {
        notSelf(id);
        if (target.status === 'disabled') throw new Error(`${target.name} is already disabled.`);
        const actor = getCurrentAdmin()!;
        if (
          !canManageRole(actor.role, target.role, {
            nextRole: 'disabled',
            activeSuperAdmins: activeSuperAdmins(),
          })
        ) {
          throw new Error(LAST_SUPER_ADMIN);
        }
        const updated: StoredAdmin = { ...target, status: 'disabled' };
        save(updated);
        return toAdminUser(updated);
      },
    );
  },

  async enable(id: string): Promise<AdminUser> {
    await delay();
    const target = find(id);
    return withAudit(
      {
        permission: 'admins.manage',
        action: 'admin.enable',
        targetType: 'admin',
        targetId: id,
        summary: `Enabled ${target.name}`,
        before: { status: target.status },
        after: (updated) => ({ status: updated.status }),
      },
      async () => {
        if (target.status === 'active') throw new Error(`${target.name} is already active.`);
        const updated: StoredAdmin = { ...target, status: 'active' };
        save(updated);
        return toAdminUser(updated);
      },
    );
  },

  /** Returns a new temporary password; the admin must change it at next login. */
  async resetPassword(id: string): Promise<string> {
    await delay();
    const target = find(id);
    return withAudit(
      {
        permission: 'admins.manage',
        action: 'admin.reset_password',
        targetType: 'admin',
        targetId: id,
        summary: `Reset the password for ${target.name}`,
        after: () => ({ reset: true }),
      },
      async () => {
        notSelf(id);
        const temporary = makeTempPassword();
        save({ ...target, passwordHash: await hashPassword(temporary), mustChangePassword: true });
        return temporary;
      },
    );
  },
};
