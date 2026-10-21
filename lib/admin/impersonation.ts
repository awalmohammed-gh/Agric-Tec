// "View as farmer" (phase A8). DEMO ONLY: a real backend would issue a scoped, read-only token
// and check it on every request.
//
// 1. The console calls startImpersonation(): permission check + audit (farmer.impersonate), then a
//    single-use token valid for one minute is saved and the farmer app opens with ?impersonate=…
// 2. The farmer app's DataLoader calls claimImpersonation(): it checks the token and that the admin
//    is still signed in with the permission, then keeps { adminId, farmerId, startedAt } in this
//    tab's sessionStorage. The tab then loads that farmer's data with storage read-only.
// 3. endImpersonation() (the bar's Exit) clears it and logs the end.

import { getCurrentAdmin } from '@/lib/admin/admin-session';
import { appendAudit, withAudit } from '@/lib/admin/audit';
import { can } from '@/lib/admin/permissions';
import { readFarmerData, readUsers } from '@/lib/admin/farmer-data';
import { generateId } from '@/lib/utils';
import { sessionStore, storage } from '@/services/storage';
import type { ImpersonationView } from '@/store/auth-store';
import type { Session } from '@/types';

const TOKEN_TTL_MS = 60_000;
const SESSION_KEY = 'impersonation';
const COOKIE = 'agrictec_impersonating';
const tokenKey = (token: string) => `impersonation-token:${token}`;

interface StoredToken extends ImpersonationView {
  expiresAt: string;
}

function setCookie(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${COOKIE}=1; path=/; max-age=7200; SameSite=Lax`
    : `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Console side: audits the start and returns the farmer-app URL to open in a new tab. */
export async function startImpersonation(farmerId: string): Promise<string> {
  const user = readUsers().find((u) => u.id === farmerId);
  if (!user) throw new Error('Farmer not found.');
  const farmerName = readFarmerData(farmerId).profile.name || user.email;
  return withAudit(
    {
      permission: 'farmers.impersonate',
      action: 'farmer.impersonate',
      targetType: 'farmer',
      targetId: farmerId,
      summary: `Viewed the app as ${farmerName} (read-only)`,
      after: () => ({ readOnly: true }),
    },
    async () => {
      if (user.isGuest) throw new Error('The guest account can’t be viewed as a farmer.');
      const admin = getCurrentAdmin()!;
      const token = generateId();
      const now = Date.now();
      storage.set<StoredToken>(tokenKey(token), {
        adminId: admin.id,
        adminName: admin.name,
        farmerId,
        farmerName,
        startedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
      });
      return `/dashboard?impersonate=${encodeURIComponent(token)}`;
    },
  );
}

/** The admin is still signed in, active and allowed to view as a farmer. */
function adminStillAllowed(adminId: string): boolean {
  const admin = getCurrentAdmin();
  return Boolean(admin && admin.id === adminId && can(admin.role, 'farmers.impersonate'));
}

/**
 * Farmer tab: exchanges a token for this tab's impersonation. Single use (the token is deleted)
 * and only within a minute of starting. Null when invalid, expired or the admin isn't allowed.
 */
export function claimImpersonation(token: string): ImpersonationView | null {
  const stored = storage.get<StoredToken | null>(tokenKey(token), null);
  if (stored) storage.remove(tokenKey(token));
  if (!stored || Date.parse(stored.expiresAt) < Date.now()) return null;
  if (!adminStillAllowed(stored.adminId)) return null;
  const view: ImpersonationView = {
    adminId: stored.adminId,
    adminName: stored.adminName,
    farmerId: stored.farmerId,
    farmerName: stored.farmerName,
    startedAt: stored.startedAt,
  };
  sessionStore.set(SESSION_KEY, view);
  setCookie(true);
  return view;
}

/**
 * This tab's impersonation, if any and still valid (the admin may have signed out or lost the
 * permission since; then it ends).
 */
export function activeImpersonation(): ImpersonationView | null {
  const view = sessionStore.get<ImpersonationView | null>(SESSION_KEY, null);
  if (!view) return null;
  if (!adminStillAllowed(view.adminId) || !readUsers().some((u) => u.id === view.farmerId)) {
    sessionStore.set(SESSION_KEY, null);
    setCookie(false);
    return null;
  }
  return view;
}

/** Ends this tab's impersonation and logs it. Storage becomes writable again first. */
export function endImpersonation(): void {
  const view = sessionStore.get<ImpersonationView | null>(SESSION_KEY, null);
  storage.setReadOnly(false);
  sessionStore.set(SESSION_KEY, null);
  setCookie(false);
  const admin = getCurrentAdmin();
  if (view && admin && admin.id === view.adminId) {
    appendAudit(admin, {
      action: 'farmer.impersonate_end',
      targetType: 'farmer',
      targetId: view.farmerId,
      summary: `Stopped viewing the app as ${view.farmerName}`,
    });
  }
}

/** The farmer session the read-only view runs as (never saved: storage is read-only). */
export function impersonatedSession(view: ImpersonationView): Session {
  const user = readUsers().find((u) => u.id === view.farmerId);
  return {
    userId: view.farmerId,
    email: user?.email ?? '',
    isGuest: false,
    role: 'farmer',
    startedAt: view.startedAt,
  };
}

/**
 * The bar's Exit (and Sign out while viewing): ends the view, then closes this tab, or, when the
 * browser won't let a script close it, goes back to the farmer in the console.
 */
export function exitImpersonation(): void {
  const farmerId = sessionStore.get<ImpersonationView | null>(SESSION_KEY, null)?.farmerId;
  endImpersonation();
  window.close();
  // Still open (not opened by a script): a full page load also clears the in-memory stores.
  setTimeout(() => {
    window.location.assign(farmerId ? `/admin/farmers/${farmerId}` : '/admin/farmers');
  }, 150);
}
