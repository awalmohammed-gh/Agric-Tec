'use client';

import { useEffect } from 'react';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { authService, USERS_KEY } from '@/services/auth.service';
import { loansService } from '@/services/loans.service';
import { storage } from '@/services/storage';
import {
  refreshUserStores,
  resetAllStores,
  signOutAndReset,
  useAuthStore,
  usePlatformStore,
} from '@/store';
import { useLoanStore } from '@/store/loan-store';

const PLATFORM_PREFIX = 'platform:';
const SESSION_KEY = 'session';
/** Several writes usually land together (a save touches more than one key): sync once. */
const SETTLE_MS = 250;

/** Swaps in the farmer's applications without a loading state (no skeleton flash). */
async function refreshApplications(userId: string) {
  const applications = await loansService.listApplications(userId);
  const store = useLoanStore.getState();
  if (store.userId === userId && store.status === 'ready') useLoanStore.setState({ applications });
}

/** What another tab changed since the last sync. */
interface Pending {
  platform: boolean;
  applications: boolean;
  /** This farmer's own data ("<userId>:*"). */
  own: boolean;
  /** The session or the accounts list: signed out, switched user, suspended or deleted. */
  account: boolean;
}

const nothing = (): Pending => ({
  platform: false,
  applications: false,
  own: false,
  account: false,
});

/**
 * Keeps an open farmer tab in step with other tabs (phase A15). The browser fires `storage` here
 * when another tab writes: an admin saving lenders, rates, rules, content or a loan decision, or
 * the same farmer adding records elsewhere. A visible tab syncs at once; a hidden one when it
 * comes back into focus. The stores reload in place (no skeleton). A sign-out, a switch to
 * another account, a suspension or a deletion sends this tab to the login page.
 */
export function usePlatformSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let pending = nothing();
    let timer: number | undefined;

    async function sync() {
      const changes = pending;
      pending = nothing();
      const { session, impersonation } = useAuthStore.getState();
      const userId = session?.userId;
      if (!userId) return;

      // The admin's read-only "View as farmer" has no stored session; only its data can change.
      if (changes.account && !impersonation) {
        const stored = await authService.getSession();
        if (!stored || stored.userId !== userId) {
          // Signed out, or signed in as someone else, in another tab. Only forget this tab's copy:
          // the stored session (if any) now belongs to the other account.
          resetAllStores();
          window.location.replace(stored ? '/dashboard' : '/login');
          return;
        }
        const status = await authService.accountStatus(userId);
        if (status === 'suspended' || status === 'deleted') {
          await signOutAndReset();
          window.location.replace(`/login?reason=${status}`);
          return;
        }
      }
      const work: Promise<unknown>[] = [];
      if (changes.platform) work.push(usePlatformStore.getState().refresh());
      if (changes.own) work.push(refreshUserStores(userId));
      else if (changes.applications) work.push(refreshApplications(userId));
      await Promise.all(work);
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void sync().catch(() => {}), SETTLE_MS);
    }

    const hasPending = () => Object.values(pending).some(Boolean);

    const unsubscribe = storage.onExternalChange((key) => {
      const userId = useAuthStore.getState().session?.userId;
      if (key === null) pending.account = true;
      else if (key === SESSION_KEY || key === USERS_KEY) pending.account = true;
      else if (key === PLATFORM_KEYS.loanApplications) {
        pending.platform = true;
        pending.applications = true;
      } else if (key.startsWith(PLATFORM_PREFIX)) pending.platform = true;
      else if (userId && key.startsWith(`${userId}:`)) pending.own = true;
      else return;
      if (document.visibilityState === 'visible') schedule();
    });

    const onFocus = () => {
      if (hasPending()) schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
