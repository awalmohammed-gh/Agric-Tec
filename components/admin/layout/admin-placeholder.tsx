'use client';

import { usePathname } from 'next/navigation';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/admin/layout/page-header';
import { RequirePermission } from '@/components/admin/layout/require-permission';
import { Card } from '@/components/ui/card';
import { getAdminPageMeta } from '@/constants/admin-navigation';
import type { Permission } from '@/types/admin';

/** A page that a later phase builds: guarded like the real page, with what's coming. */
export function AdminPlaceholder({
  permission,
  phase,
  features,
  title,
}: {
  permission: Permission;
  /** e.g. "A7". */
  phase: string;
  features: string[];
  /** Defaults to the route's title (detail pages pass their own). */
  title?: string;
}) {
  const meta = getAdminPageMeta(usePathname());
  return (
    <RequirePermission permission={permission}>
      <PageHeader title={title ?? meta.title} description={meta.subtitle} />
      <Card className="max-w-2xl">
        <div className="flex items-start gap-4">
          <span className="bg-purple/15 text-ink-purple inline-flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Construction size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-text font-semibold">Coming in phase {phase}</p>
            <ul className="text-text-dim mt-2 list-disc space-y-1 pl-5 text-sm">
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </RequirePermission>
  );
}
