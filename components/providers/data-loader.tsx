'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { MaintenanceScreen } from '@/components/shared/maintenance-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authService } from '@/services/auth.service';
import { loadAllStores, signOutAndReset, useAuthStore, usePlatformStore } from '@/store';

type LoadState = 'loading' | 'ready' | 'error' | 'maintenance';

/** What hydrate() decided: render the app, show maintenance, or leave for the login page. */
type HydrateResult = 'ready' | 'maintenance' | { redirect: string };

/**
 * Hydrates the stores BEFORE rendering the app: first the admin's flags (maintenance mode), then
 * auth and the account's status, then every data store.
 * (The old app loaded data before auth had finished, which caused a race condition.)
 */
export function DataLoader({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const maintenanceMessage = usePlatformStore((s) => s.flags.maintenanceMessage);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<HydrateResult> {
      // Maintenance mode replaces the whole app for farmers (admins use /admin, unaffected).
      const flags = await usePlatformStore.getState().loadFlags();
      if (flags.maintenanceMode) return 'maintenance';

      // getSession() also clears the proxy cookie when no session is stored (e.g. the cookie
      // survived but localStorage was cleared), so /login won't bounce us back here.
      const session = await useAuthStore.getState().init();
      if (!session) {
        return { redirect: `/login?next=${encodeURIComponent(window.location.pathname)}` };
      }
      // An admin may have suspended or deleted the account since this session started.
      const status = await authService.checkAccount(session.userId);
      if (status === 'suspended' || status === 'deleted') {
        await signOutAndReset();
        return { redirect: `/login?reason=${status}` };
      }
      await loadAllStores(session.userId);
      return 'ready';
    }

    hydrate().then(
      (result) => {
        if (cancelled) return;
        if (typeof result === 'string') setState(result);
        else router.replace(result.redirect); // keep the skeleton while redirecting
      },
      (error: unknown) => {
        console.error('[DataLoader] Failed to load data', error);
        if (!cancelled) setState('error');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-sm text-center">
          <AlertTriangle size={32} aria-hidden="true" className="text-ink-gold mx-auto mb-3" />
          <p className="text-text font-semibold">We couldn&apos;t load your data</p>
          <p className="text-text-dim mt-1 text-sm">
            Check your browser storage settings and try again.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setState('loading');
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (state === 'maintenance') return <MaintenanceScreen message={maintenanceMessage} />;

  if (state === 'loading') return <AppSkeleton />;

  return <>{children}</>;
}

/** Full-page placeholder shaped like the app shell. */
function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading AgriCtec" className="flex min-h-screen">
      <div className="glass fixed inset-y-3 left-3 hidden w-[260px] space-y-3 rounded-3xl p-5 min-[900px]:block">
        <Skeleton className="mb-6 h-11 w-40" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="min-w-0 flex-1 px-5 py-6 min-[768px]:px-8 min-[900px]:ml-[272px] min-[900px]:pt-3">
        <div className="glass min-[900px]:h-header mb-6 flex h-16 items-center gap-3 rounded-2xl px-3">
          <Skeleton className="size-10" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="mb-6 h-56 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    </div>
  );
}
