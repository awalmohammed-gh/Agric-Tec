'use client';

import { Hourglass, Inbox } from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLoanStore } from '@/store/loan-store';

/** Applications the farmer has sent, newest first, with reference and status. */
export function MyApplications({ className }: { className?: string }) {
  const applications = useLoanStore((s) => s.applications);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>My Applications</CardTitle>
          <CardSub>Track what you have sent to lenders</CardSub>
        </div>
        {applications.length > 0 && (
          <span className="bg-glass-strong text-text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {applications.length}
          </span>
        )}
      </CardHeader>

      {applications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Build a loan and apply. Your applications will appear here."
          className="py-6"
        />
      ) : (
        <ul className="space-y-3">
          {applications.slice(0, 5).map((app) => {
            const partner = LOAN_PARTNERS.find((p) => p.id === app.partnerId);
            return (
              <li key={app.id} className="border-border bg-glass rounded-2xl border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: partner?.color ?? 'var(--accent)' }}
                    />
                    <p className="text-text truncate text-sm font-semibold">
                      {partner?.name ?? 'Lender'}
                    </p>
                  </div>
                  <span className="bg-gold/15 text-ink-gold inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    <Hourglass size={11} aria-hidden="true" /> In review
                  </span>
                </div>
                <p className="text-text mt-1.5 text-sm">
                  <strong className="tabular-nums">{formatGHS(app.amount)}</strong>
                  <span className="text-text-dim">
                    {' '}
                    · {app.months} months · {formatGHS(app.monthly)}/mo
                  </span>
                </p>
                <p className="text-text-mute mt-1 flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-mono">{app.reference}</span>
                  <span>Sent {formatDate(new Date(app.createdAt))}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
