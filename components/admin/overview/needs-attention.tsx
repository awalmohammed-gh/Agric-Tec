'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CircleCheckBig,
  ClipboardList,
  MessageSquareWarning,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useAdminRole } from '@/hooks/admin/use-can';
import { needsAttention, type AttentionItem } from '@/lib/admin/overview';
import { cn } from '@/lib/utils';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { FeatureFlags } from '@/types/admin';

const ICONS: Record<AttentionItem['key'], LucideIcon> = {
  maintenance: Wrench,
  risk: ShieldAlert,
  verifications: BadgeCheck,
  loans: ClipboardList,
  appeals: MessageSquareWarning,
};

/** The prioritized to-do list: only what this role can act on (maintenance shows to all). */
export function NeedsAttention({ flags }: { flags: FeatureFlags | null }) {
  const role = useAdminRole();
  const farmers = useAdminDataStore((s) => s.farmers);
  const apps = useAdminDataStore((s) => s.applications);
  const riskFlags = useAdminDataStore((s) => s.riskFlags);
  const verifications = useAdminDataStore((s) => s.verifications);
  const items = needsAttention(
    { farmers, apps, flags: riskFlags, verifications, featureFlags: flags },
    role,
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Needs attention</CardTitle>
          <CardSub>What to look at next, most urgent first</CardSub>
        </div>
      </CardHeader>
      {items.length === 0 ? (
        <p className="text-ink-green flex items-center gap-2 py-6 text-sm font-semibold">
          <CircleCheckBig size={18} aria-hidden="true" />
          All caught up
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            return (
              <li
                key={item.key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  item.urgent ? 'border-danger/50 bg-danger/10' : 'border-border bg-glass',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
                    item.urgent ? 'bg-danger/20 text-ink-red' : 'bg-purple/15 text-ink-purple',
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <p
                  className={cn(
                    'min-w-0 flex-1 text-sm',
                    item.urgent ? 'text-ink-red font-semibold' : 'text-text',
                  )}
                >
                  {item.text}
                </p>
                {item.actionable && (
                  <Link
                    href={item.href}
                    className={cn(
                      'group inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-semibold',
                      item.urgent ? 'text-ink-red' : 'text-ink-purple',
                    )}
                  >
                    Review
                    <ArrowRight
                      size={13}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                    <span className="sr-only">: {item.text}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
