'use client';

import { Calculator, Check, Hourglass, Inbox, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLoanStore } from '@/store/loan-store';

/** Every application starts as sent and in review; the lender's decision comes next. */
const STAGES = ['Sent', 'In review', 'Decision'] as const;
const CURRENT_STAGE = 1;

/** Applications the farmer has sent, newest first, each with a status tracker. */
export function MyApplications({ className }: { className?: string }) {
  const applications = useLoanStore((s) => s.applications);
  const setTab = useLoanStore((s) => s.setTab);
  const total = applications.reduce((sum, app) => sum + app.amount, 0);

  return (
    <Card className={cn('@container rounded-3xl', className)}>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Inbox size={17} aria-hidden="true" className="text-ink-green" />
            My applications
          </CardTitle>
          <CardSub>
            {applications.length > 0
              ? `${applications.length} sent · ${formatGHS(total)} requested in total`
              : 'Track what you have sent to lenders'}
          </CardSub>
        </div>
      </CardHeader>

      {applications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Build a loan, check your eligibility and apply. Your applications will appear here."
          action={
            <Button icon={Calculator} onClick={() => setTab('apply')}>
              Build my loan
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          {applications.map((app) => {
            const partner = LOAN_PARTNERS.find((p) => p.id === app.partnerId);
            return (
              <li key={app.id} className="border-border bg-glass rounded-2xl border p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: partner?.color ?? 'var(--accent)' }}
                  >
                    <Landmark size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text truncate text-sm font-semibold">
                      {partner?.name ?? 'Lender'}
                    </p>
                    <p className="text-text-mute text-xs">
                      {app.purpose} · sent {formatDate(new Date(app.createdAt))}
                    </p>
                  </div>
                  <span className="bg-gold/15 text-ink-gold inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    <Hourglass size={11} aria-hidden="true" /> In review
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-text-mute">Amount</dt>
                    <dd className="text-text text-sm font-bold tabular-nums">
                      {formatGHS(app.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-mute">Monthly</dt>
                    <dd className="text-text text-sm font-bold tabular-nums">
                      {formatGHS(app.monthly)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-mute">Term</dt>
                    <dd className="text-text text-sm font-bold">{app.months} months</dd>
                  </div>
                </dl>

                <ol className="mt-4 flex items-center" aria-label="Application status">
                  {STAGES.map((stage, i) => {
                    const done = i < CURRENT_STAGE;
                    const current = i === CURRENT_STAGE;
                    return (
                      <li key={stage} className="flex flex-1 items-center last:flex-none">
                        <span className="flex flex-col items-center gap-1">
                          <span
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold',
                              done && 'bg-[#10b981] text-[#022c22]',
                              current && 'bg-gold/20 text-ink-gold ring-gold/40 ring-2',
                              !done && !current && 'bg-glass-strong text-text-mute',
                            )}
                          >
                            {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] whitespace-nowrap',
                              current ? 'text-ink-gold font-semibold' : 'text-text-mute',
                            )}
                          >
                            {stage}
                            <span className="sr-only">
                              {done ? ' (done)' : current ? ' (current)' : ''}
                            </span>
                          </span>
                        </span>
                        {i < STAGES.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              'mx-1 mb-4 h-0.5 flex-1 rounded-full',
                              done ? 'bg-[#10b981]' : 'bg-border',
                            )}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>

                <p className="text-text-mute mt-3 font-mono text-[11px]">Ref {app.reference}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
