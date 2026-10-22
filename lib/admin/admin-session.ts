// DEMO ONLY: the admin session and password hashes live in localStorage. A real backend must
// authenticate every request and enforce roles server-side; these checks only keep the demo honest.

import { assertCan } from '@/lib/admin/permissions';
import { ADMIN_SESSION_KEY, PLATFORM_KEYS } from '@/lib/admin/keys';
import { storage } from '@/services/storage';
import type { AdminUser, Permission } from '@/types/admin';

/** An admin as stored. The hash never leaves the services: callers get an AdminUser. */
export interface StoredAdmin extends AdminUser {
  passwordHash: string;
  /** Set on the super admin when its sign-in came from .env (see lib/admin/super-admin.ts). */
  configuredFrom?: string;
}

/**
 * "agrictec:admin-session". Separate from the farmer's "agrictec:session" (and its cookie), so
 * signing in or out on one side never touches the other.
 */
export interface StoredAdminSession {
  adminId: string;
  startedAt: string;
  /** Last mouse/keyboard/touch activity, shared by every open tab. */
  lastActivityAt?: string;
}

/**
 * Minutes of inactivity before an admin is signed out (spec: 30). For a quick manual test, set
 * NEXT_PUBLIC_ADMIN_IDLE_MINUTES=1 in .env.local and restart the dev server.
 */
const idleMinutes = Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_MINUTES) || 30;
export const ADMIN_IDLE_MS = Math.max(1, idleMinutes) * 60_000;
/** The warning shows this long before sign-out (2 minutes, or half the timeout if shorter). */
export const ADMIN_IDLE_WARNING_MS = Math.min(2 * 60_000, ADMIN_IDLE_MS / 2);
export const ADMIN_IDLE_MINUTES = ADMIN_IDLE_MS / 60_000;

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

/** When the session was last active, in ms (sessions from before A4 count from their start). */
export const lastActivityOf = (session: StoredAdminSession): number =>
  Date.parse(session.lastActivityAt ?? session.startedAt);

/** True once the session has been idle for the full timeout. */
export const isSessionIdle = (session: StoredAdminSession, now = Date.now()): boolean =>
  now - lastActivityOf(session) >= ADMIN_IDLE_MS;

/**
 * The signed-in admin, re-read from the admin list on every call, so a role change or a disabled
 * account takes effect immediately. Null when signed out, idle too long, disabled or deleted.
 */
export function getCurrentAdmin(): AdminUser | null {
  const session = readAdminSession();
  if (!session || isSessionIdle(session)) return null;
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
