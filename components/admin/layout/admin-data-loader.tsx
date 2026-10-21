'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AdminSessionGate } from '@/components/admin/auth/admin-session-gate';
import { AdminBrand } from '@/components/admin/layout/admin-brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isSeeded, seedPlatform } from '@/lib/admin/seed';
import { useAdminDataStore } from '@/store/admin/admin-data-store';

type LoadState = 'seeding' | 'loading' | 'ready' | 'error';

/** Refresh the cached data (and sidebar badges) when the tab comes back, at most this often. */
const REFRESH_ON_FOCUS_MS = 30_000;

/**
 * The console's loader. AdminSessionGate first: session check, redirect when signed out,
 * the forced password change, and SessionTimeout. Then: seed the demo platform if it has never
 * been seeded ("Preparing demo data…"), and load the admin data store before rendering pages.
 */
export function AdminDataLoader({ children }: { children: ReactNode }) {
  return (
    <AdminSessionGate>
      <PlatformLoader>{children}</PlatformLoader>
    </AdminSessionGate>
  );
}

function PlatformLoader({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>(() => (isSeeded() ? 'loading' : 'seeding'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSeeded()) await seedPlatform();
      if (cancelled) return;
      setState('loading');
      await useAdminDataStore.getState().refresh();
      if (cancelled) return;
      setState(useAdminDataStore.getState().status === 'error' ? 'error' : 'ready');
    })().catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    function onFocus() {
      const { loadedAt, refresh } = useAdminDataStore.getState();
      if (!loadedAt || Date.now() - Date.parse(loadedAt) > REFRESH_ON_FOCUS_MS) void refresh();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-sm text-center">
          <AlertTriangle size={32} aria-hidden="true" className="text-ink-gold mx-auto mb-3" />
          <p className="text-text font-semibold">The console couldn&apos;t load its data</p>
          <p className="text-text-dim mt-1 text-sm">
            {useAdminDataStore.getState().error ?? 'Check your browser storage and try again.'}
          </p>
          <Button className="mt-5" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (state !== 'ready') {
    return (
      <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AdminBrand tag="Console" />
        <p className="text-text-dim flex items-center gap-2 text-sm">
          <Loader2 size={16} aria-hidden="true" className="text-ink-purple animate-spin" />
          {state === 'seeding' ? 'Preparing demo data…' : 'Loading the console…'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
