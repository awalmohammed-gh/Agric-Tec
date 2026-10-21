// DEMO ONLY: the admin session and password hashes live in localStorage. A real backend must
// authenticate every request and enforce roles server-side; these checks only keep the demo honest.

import { assertCan } from '@/lib/admin/permissions';
import { ADMIN_SESSION_KEY, PLATFORM_KEYS } from '@/lib/admin/keys';
import { storage } from '@/services/storage';
import type { AdminUser, Permission } from '@/types/admin';

/** An admin as stored. The hash never leaves the services: callers get an AdminUser. */
export interface StoredAdmin extends AdminUser {
  passwordHash: string;
}

export interface StoredAdminSession {
  adminId: string;
  startedAt: string;
}

export const readAdmins = (): StoredAdmin[] => storage.get<StoredAdmin[]>(PLATFORM_KEYS.admins, []);
export const writeAdmins = (admins: StoredAdmin[]): void =>
  storage.set(PLATFORM_KEYS.admins, admins);

/** Whitelists the public fields, so the password hash can never leak to a caller. */
export function toAdminUser(stored: StoredAdmin): AdminUser {
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    role: stored.role,
    status: stored.status,
    mustChangePassword: stored.mustChangePassword,
    ...(stored.lastLoginAt && { lastLoginAt: stored.lastLoginAt }),
    createdAt: stored.createdAt,
    ...(stored.createdBy && { createdBy: stored.createdBy }),
  };
}

export const readAdminSession = (): StoredAdminSession | null =>
  storage.get<StoredAdminSession | null>(ADMIN_SESSION_KEY, null);

/**
 * The signed-in admin, re-read from the admin list on every call, so a role change or a disabled
 * account takes effect immediately. Null when signed out, disabled or deleted.
 */
export function getCurrentAdmin(): AdminUser | null {
  const session = readAdminSession();
  if (!session) return null;
  const stored = readAdmins().find((a) => a.id === session.adminId);
  return stored && stored.status === 'active' ? toAdminUser(stored) : null;
}

/**
 * Returns the current admin, or throws a PermissionError when there is no admin or the role lacks
 * the permission. An admin still on a temporary password can do nothing until they change it.
 */
export function requirePermission(permission: Permission): AdminUser {
  const admin = getCurrentAdmin();
  assertCan(admin?.role, permission);
  if (admin!.mustChangePassword) {
    throw new Error('Change your temporary password before continuing.');
  }
  return admin!;
}
