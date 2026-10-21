'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ban, ChevronRight, CircleAlert } from 'lucide-react';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useCan } from '@/hooks/admin/use-can';
import { DATE_RANGES, loanStageReach, type DateRange } from '@/lib/admin/overview';
import { useAdminDataStore } from '@/store/admin/admin-data-store';

/**
 * Submitted → Under review → Approved → Disbursed → Repaid, counting every application that
 * reached each step (from its history), with the conversion between steps. Rejected and
 * defaulted sit to the side.
 */
export function LoanFunnel({ range }: { range: DateRange }) {
  const apps = useAdminDataStore((s) => s.applications);
  const canLoans = useCan('loans.view');
  const { stages, rejected, defaulted, total } = loanStageReach(apps, range);
  const max = Math.max(1, stages[0]?.reached ?? 0);
  const rangeLabel = DATE_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? '';

  const step = (status: string, children: ReactNode) =>
    canLoans ? (
      <Link
        href={`/admin/loans?status=${status}`}
        className="hover:border-purple/50 block h-full rounded-xl border border-transparent transition-colors"
      >
        {children}
      </Link>
    ) : (
      children
    );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Loan funnel</CardTitle>
          <CardSub>
            {total} application{total === 1 ? '' : 's'} made {rangeLabel}
          </CardSub>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-4 xl:flex-row">
        <ol className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-5" aria-label="Loan pipeline">
          {stages.map((stage, index) => (
            <li key={stage.status} className="relative">
              {step(
                stage.status,
                <div className="bg-glass h-full rounded-xl p-3">
                  <p className="text-text-mute text-xs font-semibold">{stage.label}</p>
                  <p className="font-display text-text mt-1 text-2xl font-bold tabular-nums">
                    {stage.reached}
                  </p>
                  <div
                    aria-hidden="true"
                    className="bg-glass-strong mt-2 h-1.5 overflow-hidden rounded-full"
                  >
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#7c3aed] to-[#a855f7]"
                      style={{ width: `${(stage.reached / max) * 100}%` }}
                    />
                  </div>
                  <p className="text-text-dim mt-2 text-xs">
                    {index === 0
                      ? 'Started'
                      : stage.conversion === null
                        ? '—'
                        : `${stage.conversion}% of previous`}
                  </p>
                </div>,
              )}
              {index < stages.length - 1 && (
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="text-text-mute absolute top-1/2 -right-2.5 z-10 hidden -translate-y-1/2 sm:block"
                />
              )}
            </li>
          ))}
        </ol>
        <ul className="grid grid-cols-2 gap-2 xl:w-44 xl:grid-cols-1" aria-label="Ended early">
          <li>
            {step(
              'rejected',
              <div className="border-danger/30 bg-danger/5 h-full rounded-xl border p-3">
                <p className="text-ink-red flex items-center gap-1.5 text-xs font-semibold">
                  <Ban size={13} aria-hidden="true" /> Rejected
                </p>
                <p className="font-display text-text mt-1 text-xl font-bold tabular-nums">
                  {rejected}
                </p>
              </div>,
            )}
          </li>
          <li>
            {step(
              'defaulted',
              <div className="border-danger/30 bg-danger/5 h-full rounded-xl border p-3">
                <p className="text-ink-red flex items-center gap-1.5 text-xs font-semibold">
                  <CircleAlert size={13} aria-hidden="true" /> Defaulted
                </p>
                <p className="font-display text-text mt-1 text-xl font-bold tabular-nums">
                  {defaulted}
                </p>
              </div>,
            )}
          </li>
        </ul>
      </div>
    </Card>
  );
}
