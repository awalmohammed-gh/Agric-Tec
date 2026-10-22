'use client';

import { useEffect } from 'react';
import { loansService } from '@/services/loans.service';
import { useAuthStore } from '@/store/auth-store';
import { useLoanStore } from '@/store/loan-store';
import { usePlatformStore } from '@/store/platform-store';

/** Platform keys as they appear in localStorage ("agrictec:platform:*"). */
const PLATFORM_PREFIX = 'agrictec:platform:';
const LOAN_APPLICATIONS_KEY = `${PLATFORM_PREFIX}loan-applications`;

/** Swaps in the farmer's applications without a loading state (no skeleton flash). */
async function refreshApplications(userId: string) {
  const applications = await loansService.listApplications(userId);
  const store = useLoanStore.getState();
  if (store.userId === userId && store.status === 'ready') useLoanStore.setState({ applications });
}

/**
 * Keeps an open farmer tab in step with the admin console. When an admin saves (lenders, rates,
 * credit rules, content, a loan decision…) in another tab, the browser fires a `storage` event
 * here, and the affected stores reload in place, so the farmer sees the change at once.
 */
export function usePlatformSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onStorage = (event: StorageEvent) => {
      // A cleared storage (key null) is handled by the next sign-in, not here.
      if (!event.key?.startsWith(PLATFORM_PREFIX)) return;
      const userId = useAuthStore.getState().session?.userId;
      if (!userId) return;
      if (event.key === LOAN_APPLICATIONS_KEY) void refreshApplications(userId).catch(() => {});
      void usePlatformStore
        .getState()
        .refresh()
        .catch(() => {});
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [enabled]);
}
