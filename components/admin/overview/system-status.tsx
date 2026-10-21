'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/hooks/admin/use-can';
import type { PlatformStatus } from '@/hooks/admin/use-platform-status';
import { cn } from '@/lib/utils';
import type { FeatureFlags } from '@/types/admin';

const FEATURES: { key: keyof FeatureFlags; label: string }[] = [
  { key: 'signupOpen', label: 'Sign-ups' },
  { key: 'guestMode', label: 'Guest mode' },
  { key: 'aiAssistant', label: 'AI Assistant' },
  { key: 'cropDoctor', label: 'Crop Doctor' },
  { key: 'yieldPredictor', label: 'Yield Predictor' },
  { key: 'loans', label: 'Loans' },
  { key: 'market', label: 'Market' },
  { key: 'pdfReports', label: 'PDF reports' },
];

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

/** Feature flags (green on, grey off), maintenance, credit rules version, seed date and storage. */
export function SystemStatus({ status }: { status: PlatformStatus | null }) {
  const canSettings = useCan('settings.manage');

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>System status</CardTitle>
          <CardSub>What farmers can use right now</CardSub>
        </div>
        {canSettings && (
          <Link href="/admin/settings" className="text-ink-purple text-xs font-semibold">
            Settings
          </Link>
        )}
      </CardHeader>
      {!status ? (
        <div className="space-y-2" role="status" aria-label="Loading system status">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : (
        <div className="space-y-4">
          <p
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
              status.flags.maintenanceMode
                ? 'bg-danger/10 text-ink-red'
                : 'bg-accent/10 text-ink-green',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 rounded-full',
                status.flags.maintenanceMode ? 'bg-danger' : 'bg-accent',
              )}
            />
            {status.flags.maintenanceMode ? 'Maintenance mode is ON' : 'Farmer app is online'}
          </p>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm" aria-label="Features">
            {FEATURES.map((feature) => {
              const on = Boolean(status.flags[feature.key]);
              return (
                <li key={feature.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      on ? 'bg-accent' : 'bg-text-mute/40',
                    )}
                  />
                  <span className={on ? 'text-text' : 'text-text-mute'}>{feature.label}</span>
                  <span className="sr-only">{on ? 'on' : 'off'}</span>
                </li>
              );
            })}
          </ul>

          <dl className="border-border divide-border divide-y border-t text-sm">
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-text-mute">Credit rules</dt>
              <dd className="text-text text-right">
                Version {status.creditConfig.version}
                <span className="text-text-mute block text-xs">
                  edited {ago(status.creditConfig.updatedAt)} by {status.creditConfig.updatedBy}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-text-mute">Demo data seeded</dt>
              <dd className="text-text">{status.seededAt ? ago(status.seededAt) : 'Not seeded'}</dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-text-mute">Storage used</dt>
              <dd className="text-text tabular-nums">
                ≈ {Math.round(status.storageBytes / 1024).toLocaleString()} KB
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}
