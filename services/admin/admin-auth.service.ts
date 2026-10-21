// DEMO ONLY — this is NOT real security. Admin accounts, password hashes and the lockout live in
// localStorage, and the cookies are only hints for proxy.ts redirects. A real backend must
// authenticate admins and enforce roles on every request.
//
// The admin session ("agrictec:admin-session" + agrictec_admin/agrictec_role cookies) is separate
// from the farmer's ("agrictec:session" + agrictec_session), so neither side ever ends the other.

import { appendAudit } from '@/lib/admin/audit';
import {
  isSessionIdle,
  readAdminSession,
  readAdmins,
  toAdminUser,
  writeAdmins,
  type StoredAdminSession,
} from '@/lib/admin/admin-session';
import { ADMIN_LOCKOUT_KEY, ADMIN_SESSION_KEY } from '@/lib/admin/keys';
import { passwordProblem } from '@/lib/admin/passwords';
import { seedPlatform } from '@/lib/admin/seed';
import { formatCountdown } from '@/lib/format';
import { hashPassword } from '@/services/auth.service';
import { delay, storage } from '@/services/storage';
import type { AdminSession, AdminUser } from '@/types/admin';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;

const ADMIN_COOKIE = 'agrictec_admin';
const ROLE_COOKIE = 'agrictec_role';

interface StoredLockout {
  failures: number;
  lockedUntil?: string;
}

export interface LockStatus {
  locked: boolean;
  /** When the lock ends, while locked. */
  until?: string;
  attemptsLeft: number;
}

export type SignOutReason = 'manual' | 'timeout';

export interface SessionState {
  session: AdminSession | null;
  /** True when this check ended the session for inactivity. */
  expired: boolean;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** The cookies are only flags for proxy.ts redirects; they grant nothing on their own. */
function setCookies(admin: AdminUser): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_COOKIE}=1; path=/; max-age=43200; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE}=${admin.role}; path=/; max-age=43200; SameSite=Lax`;
}

function clearCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function lockStatus(now = Date.now()): LockStatus {
  const lockout = storage.get<StoredLockout>(ADMIN_LOCKOUT_KEY, { failures: 0 });
  if (lockout.lockedUntil && Date.parse(lockout.lockedUntil) > now) {
    return { locked: true, until: lockout.lockedUntil, attemptsLeft: 0 };
  }
  // An expired lock starts a fresh set of attempts.
  const failures = lockout.lockedUntil ? 0 : lockout.failures;
  return { locked: false, attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - failures) };
}

function failAttempt(): LockStatus {
  const current = lockStatus();
  if (current.locked) return current;
  const failures = MAX_LOGIN_ATTEMPTS - current.attemptsLeft + 1;
  if (failures >= MAX_LOGIN_ATTEMPTS) {
    const until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
    storage.set<StoredLockout>(ADMIN_LOCKOUT_KEY, { failures, lockedUntil: until });
    return { locked: true, until, attemptsLeft: 0 };
  }
  storage.set<StoredLockout>(ADMIN_LOCKOUT_KEY, { failures });
  return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS - failures };
}

export const lockedMessage = (until: string) =>
  `Too many attempts. Try again in ${formatCountdown(Date.parse(until) - Date.now())}.`;

/** The stored session and its admin, whatever their state (for sign-out and expiry). */
function storedSession(): { session: StoredAdminSession; admin: AdminUser | null } | null {
  const session = readAdminSession();
  if (!session) return null;
  const stored = readAdmins().find((a) => a.id === session.adminId);
  return { session, admin: stored ? toAdminUser(stored) : null };
}

/** Ends the admin session only: the farmer session on the same browser is untouched. */
function endSession(admin: AdminUser | null, reason: SignOutReason): void {
  if (admin) {
    appendAudit(admin, {
      action: 'admin.logout',
      targetType: 'admin',
      targetId: admin.id,
      summary:
        reason === 'timeout'
          ? `${admin.name} was signed out after inactivity`
          : `${admin.name} signed out`,
    });
  }
  storage.remove(ADMIN_SESSION_KEY);
  clearCookies();
}

export const adminAuthService = {
  /**
   * Seeds the demo platform on the first admin login, then checks the credentials. A farmer's
   * email gets the same generic error as a wrong password, so the page never reveals accounts.
   */
  async signIn(email: string, password: string): Promise<AdminSession> {
    await delay();
    const lock = lockStatus();
    if (lock.locked && lock.until) throw new Error(lockedMessage(lock.until));

    await seedPlatform();
    const normalized = normalizeEmail(email);
    const admins = readAdmins();
    const stored = admins.find((a) => a.email === normalized);
    if (!stored || stored.passwordHash !== (await hashPassword(password))) {
      const after = failAttempt();
      if (after.locked && after.until) throw new Error(lockedMessage(after.until));
      throw new Error(
        `Incorrect email or password. ${after.attemptsLeft} attempt${after.attemptsLeft === 1 ? '' : 's'} left.`,
      );
    }
    // Only checked after the password matched, so it reveals nothing to a guesser.
    if (stored.status !== 'active') throw new Error('This admin account is disabled.');

    storage.remove(ADMIN_LOCKOUT_KEY);
    const now = new Date().toISOString();
    const updated = { ...stored, lastLoginAt: now };
    writeAdmins(admins.map((a) => (a.id === stored.id ? updated : a)));
    storage.set<StoredAdminSession>(ADMIN_SESSION_KEY, {
      adminId: stored.id,
      startedAt: now,
      lastActivityAt: now,
    });
    const admin = toAdminUser(updated);
    setCookies(admin);
    appendAudit(admin, {
      action: 'admin.login',
      targetType: 'admin',
      targetId: admin.id,
      summary: `${admin.name} signed in`,
    });
    return { admin, startedAt: now };
  },

  async signOut(reason: SignOutReason = 'manual'): Promise<void> {
    await delay();
    const current = storedSession();
    endSession(current?.admin ?? null, reason);
  },

  /**
   * The current admin, re-read from the team list (so role changes apply at once). A session
   * idle past the timeout is ended here (logged as a timeout), even after a reload or in
   * another tab. Stale cookies are cleared, so proxy.ts can never loop between pages.
   */
  async sessionState(): Promise<SessionState> {
    await delay();
    const current = storedSession();
    if (!current) {
      clearCookies();
      return { session: null, expired: false };
    }
    if (isSessionIdle(current.session)) {
      endSession(current.admin, 'timeout');
      return { session: null, expired: true };
    }
    if (!current.admin || current.admin.status !== 'active') {
      endSession(null, 'manual');
      return { session: null, expired: false };
    }
    setCookies(current.admin);
    return {
      session: { admin: current.admin, startedAt: current.session.startedAt },
      expired: false,
    };
  },

  async getSession(): Promise<AdminSession | null> {
    return (await adminAuthService.sessionState()).session;
  },

  /** Records activity (mouse, keyboard, touch). Returns the new time, or null when signed out. */
  async touch(): Promise<string | null> {
    await delay(0);
    const session = readAdminSession();
    if (!session || isSessionIdle(session)) return null;
    const now = new Date().toISOString();
    storage.set<StoredAdminSession>(ADMIN_SESSION_KEY, { ...session, lastActivityAt: now });
    return now;
  },

  /** Also clears a forced change (mustChangePassword). */
  async changePassword(currentPassword: string, nextPassword: string): Promise<AdminUser> {
    await delay();
    const { session } = await adminAuthService.sessionState();
    if (!session) throw new Error('Your session has ended. Sign in again.');
    const admins = readAdmins();
    const stored = admins.find((a) => a.id === session.admin.id)!;
    if (stored.passwordHash !== (await hashPassword(currentPassword))) {
      throw new Error('Your current password is incorrect.');
    }
    const problem = passwordProblem(nextPassword);
    if (problem) throw new Error(problem);
    if (nextPassword === currentPassword) {
      throw new Error('Choose a password different from your current one.');
    }
    const updated = {
      ...stored,
      passwordHash: await hashPassword(nextPassword),
      mustChangePassword: false,
    };
    writeAdmins(admins.map((a) => (a.id === stored.id ? updated : a)));
    const admin = toAdminUser(updated);
    appendAudit(admin, {
      action: 'admin.password_change',
      targetType: 'admin',
      targetId: admin.id,
      summary: `${admin.name} changed their password`,
    });
    return admin;
  },

  /** Counts a failed login; the fifth in a row locks the login for 5 minutes. */
  async recordFailedAttempt(): Promise<LockStatus> {
    await delay(0);
    return failAttempt();
  },

  async isLocked(): Promise<LockStatus> {
    await delay(0);
    return lockStatus();
  },
};
