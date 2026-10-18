'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { loadAllStores, useAuthStore } from '@/store';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Hydrates the stores BEFORE rendering the app: first auth, then every data store.
 * (The old app loaded data before auth had finished, which caused a race condition.)
 */
export function DataLoader({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const auth = useAuthStore.getState();
      // TEMPORARY (Phase 5): fall back to the guest account when there is no session.
      // Phase 6 replaces this with a redirect to /login.
      const session = (await auth.init()) ?? (await auth.continueAsGuest());
      await loadAllStores(session.userId);
    }

    hydrate().then(
      () => {
        if (!cancelled) setState('ready');
      },
      (error: unknown) => {
        console.error('[DataLoader] Failed to load data', error);
        if (!cancelled) setState('error');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

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

  if (state === 'loading') return <AppSkeleton />;

  return <>{children}</>;
}

/** Full-page placeholder shaped like the app shell. */
function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading AgriCtec" className="flex min-h-screen">
      <div className="glass fixed inset-y-0 left-0 hidden w-[260px] space-y-3 border-y-0 border-l-0 p-5 min-[900px]:block">
        <Skeleton className="mb-6 h-11 w-40" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="min-w-0 flex-1 px-5 py-6 min-[900px]:ml-[260px] md:px-8">
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-8 h-4 w-80 max-w-full" />
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
