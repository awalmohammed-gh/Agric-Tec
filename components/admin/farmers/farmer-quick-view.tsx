'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Ban, BadgeCheck, MapPin, RotateCcw, Smartphone } from 'lucide-react';
import { StatusBadge } from '@/components/admin/shared/status-badge';
import { DetailDrawer } from '@/components/admin/shared/detail-drawer';
import { DetailList, DetailRow } from '@/components/admin/shared/detail-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { scoreLabel } from '@/lib/calculations/credit-score';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { farmersService } from '@/services/admin/farmers.service';
import type { CreditScoreBreakdown } from '@/types';
import type { FarmerAccount, FarmerDetail } from '@/types/admin';

const FACTORS: { key: Exclude<keyof CreditScoreBreakdown, 'score'>; label: string }[] = [
  { key: 'paymentHistory', label: 'Payment history' },
  { key: 'recordCompleteness', label: 'Record completeness' },
  { key: 'incomeStability', label: 'Income stability' },
  { key: 'momoActivity', label: 'MoMo activity' },
  { key: 'verification', label: 'Verification' },
];

const barTone = (value: number) =>
  value >= 75 ? 'bg-accent' : value >= 40 ? 'bg-gold' : 'bg-danger';

/**
 * A drawer with the essentials: profile, score breakdown, last 5 records and verification.
 * Give it key={farmer.userId} so its loaded detail resets when another farmer opens.
 */
export function FarmerQuickView({
  farmer,
  onClose,
  canSuspend,
  onSuspend,
  onReactivate,
}: {
  /** Null = closed. */
  farmer: FarmerAccount | null;
  onClose: () => void;
  canSuspend: boolean;
  onSuspend: (farmer: FarmerAccount) => void;
  onReactivate: (farmer: FarmerAccount) => void;
}) {
  const [detail, setDetail] = useState<FarmerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = farmer?.userId;

  useEffect(() => {
    if (!id) return;
    let active = true;
    farmersService
      .getDetail(id)
      .then((d) => active && setDetail(d))
      .catch(
        (cause: unknown) =>
          active && setError(cause instanceof Error ? cause.message : 'Could not load the farmer'),
      );
    return () => {
      active = false;
    };
  }, [id]);

  const account = detail?.account ?? farmer;
  const verification = account?.profile.verification;

  return (
    <DetailDrawer
      open={farmer !== null}
      onClose={onClose}
      title={account ? account.profile.name || account.email : 'Farmer'}
      description={
        account && (
          <span className="flex flex-wrap items-center gap-2">
            {account.email}
            <StatusBadge kind="account" status={account.status} />
          </span>
        )
      }
      footer={
        account && (
          <>
            {canSuspend &&
              (account.status === 'suspended' ? (
                <Button variant="ghost" icon={RotateCcw} onClick={() => onReactivate(account)}>
                  Reactivate
                </Button>
              ) : (
                <Button variant="danger" icon={Ban} onClick={() => onSuspend(account)}>
                  Suspend
                </Button>
              ))}
            <Link
              href={`/admin/farmers/${account.userId}`}
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-linear-to-br from-[#7c3aed] to-[#a855f7] px-5 text-sm font-semibold text-white"
            >
              Open full profile
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </>
        )
      }
    >
      {error && (
        <p role="alert" className="text-ink-red text-sm">
          {error}
        </p>
      )}
      {account && (
        <div className="space-y-6">
          {account.status === 'suspended' && account.suspendedReason && (
            <p className="border-danger/40 bg-danger/10 text-ink-red rounded-xl border px-3 py-2 text-sm">
              Suspended: {account.suspendedReason}
            </p>
          )}

          <section aria-labelledby="qv-profile">
            <h3 id="qv-profile" className="text-text mb-1 text-sm font-bold">
              Profile
            </h3>
            <DetailList>
              <DetailRow label="Phone">{account.profile.phone || null}</DetailRow>
              <DetailRow label="Region">{account.profile.region}</DetailRow>
              <DetailRow label="Farm">
                {account.profile.farmName || '—'} · {account.profile.farmType} ·{' '}
                {account.profile.acres} acres
              </DetailRow>
              <DetailRow label="Crops">{account.profile.primaryCrops.join(', ') || null}</DetailRow>
              <DetailRow label="Joined">{formatDate(new Date(account.createdAt))}</DetailRow>
              <DetailRow label="Last active">
                {account.lastActiveAt ? formatDate(new Date(account.lastActiveAt)) : null}
              </DetailRow>
              {account.tags.length > 0 && (
                <DetailRow label="Tags">
                  <span className="flex flex-wrap gap-1">
                    {account.tags.map((t) => (
                      <Badge key={t} color="purple">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </DetailRow>
              )}
            </DetailList>
          </section>

          <section aria-labelledby="qv-verify">
            <h3 id="qv-verify" className="text-text mb-2 text-sm font-bold">
              Verification
            </h3>
            <ul className="grid grid-cols-3 gap-2 text-xs">
              {(
                [
                  ['Phone', Smartphone, verification?.phone],
                  ['Location', MapPin, verification?.location],
                  ['Ghana Card', BadgeCheck, verification?.ghanaCard],
                ] as const
              ).map(([label, Icon, done]) => (
                <li
                  key={label}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border p-2 text-center',
                    done
                      ? 'border-accent/40 bg-accent/10 text-ink-green'
                      : 'border-border text-text-mute',
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                  <span className="sr-only">{done ? 'verified' : 'not verified'}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="qv-score">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 id="qv-score" className="text-text text-sm font-bold">
                Credit score
              </h3>
              <p className="text-text text-sm">
                <span className="font-display text-xl font-bold">{account.stats.score}</span>{' '}
                <span className="text-text-mute">
                  {scoreLabel(account.stats.score, detail?.creditConfig.bands)}
                </span>
              </p>
            </div>
            {detail ? (
              <ul className="space-y-2.5">
                {FACTORS.map((factor) => {
                  const value = detail.credit[factor.key];
                  return (
                    <li key={factor.key}>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-dim">
                          {factor.label}{' '}
                          <span className="text-text-mute">
                            ({detail.creditConfig.weights[factor.key]}%)
                          </span>
                        </span>
                        <span className="text-text font-semibold tabular-nums">{value}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={factor.label}
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="bg-glass-strong mt-1 h-1.5 overflow-hidden rounded-full"
                      >
                        <div
                          className={cn('h-full rounded-full', barTone(value))}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !error && <Skeleton className="h-28 w-full" />
            )}
          </section>

          <section aria-labelledby="qv-records">
            <h3 id="qv-records" className="text-text mb-2 text-sm font-bold">
              Latest records{' '}
              <span className="text-text-mute font-normal">({account.stats.records} in total)</span>
            </h3>
            {!detail ? (
              !error && <Skeleton className="h-24 w-full" />
            ) : detail.records.length === 0 ? (
              <p className="text-text-mute text-sm">No records yet.</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {detail.records.slice(0, 5).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="text-text block truncate">{record.description}</span>
                      <span className="text-text-mute text-xs">
                        {formatDate(record.date)} · {record.crop}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-semibold tabular-nums',
                        record.type === 'income'
                          ? 'text-ink-green'
                          : record.type === 'expense'
                            ? 'text-ink-red'
                            : 'text-text-mute',
                      )}
                    >
                      {record.type === 'activity'
                        ? 'Activity'
                        : `${record.type === 'income' ? '+' : '−'}${formatGHS(record.amount)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </DetailDrawer>
  );
}
