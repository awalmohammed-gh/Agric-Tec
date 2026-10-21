'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { ScrollText } from 'lucide-react';
import { RoleBadge } from '@/components/admin/layout/role-badge';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/hooks/admin/use-can';
import { auditService } from '@/services/admin/audit.service';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { AuditEntry } from '@/types/admin';

/** "2 min ago", "3 hours ago". */
export const timeAgo = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
    .replace(/ minutes?/, ' min')
    .replace(/ seconds?/, ' sec');

/** The last 10 audit entries (who, what, when). Only rendered for roles with audit.view. */
export function RecentAdminActivity() {
  const canView = useCan('audit.view');
  // Reload when the admin data refreshes, so new actions appear.
  const loadedAt = useAdminDataStore((s) => s.loadedAt);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    auditService
      .list({}, 1, 10)
      .then((page) => active && setEntries(page.items))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [canView, loadedAt]);

  if (!canView) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recent admin activity</CardTitle>
          <CardSub>The last 10 actions in the audit log</CardSub>
        </div>
        <Link href="/admin/audit-log" className="text-ink-purple text-xs font-semibold">
          Full audit log
        </Link>
      </CardHeader>
      {entries === null ? (
        <div className="space-y-2" role="status" aria-label="Loading recent activity">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No admin activity yet" />
      ) : (
        <ol className="divide-border divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="text-text text-sm font-semibold">{entry.actorName}</span>
              <RoleBadge role={entry.actorRole} />
              <span className="text-text-dim min-w-0 flex-1 basis-60 text-sm">{entry.summary}</span>
              <time
                dateTime={entry.createdAt}
                title={new Date(entry.createdAt).toLocaleString()}
                className="text-text-mute shrink-0 text-xs"
              >
                {timeAgo(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
