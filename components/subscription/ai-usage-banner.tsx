'use client';

import Link from 'next/link';
import { useSubscription } from '@/hooks/use-subscription';
import { AI_COSTS } from '@/lib/subscriptions/plans';

export function AiUsageBanner({ feature }: { feature: keyof typeof AI_COSTS }) {
  const { plan, snapshot } = useSubscription();
  const remaining = snapshot?.creditsRemaining ?? null;
  const cost = AI_COSTS[feature];
  return (
    <div
      className="border-accent/20 bg-accent/5 text-text-dim flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs"
      role="status"
    >
      <div>
        <p className="text-text font-semibold">
          {plan.name} ·{' '}
          {remaining === null
            ? 'Unlimited AI credits'
            : `${remaining} of ${snapshot?.creditsLimit ?? 0} AI credits left`}
        </p>
        <p className="mt-1">
          {cost} {cost === 1 ? 'credit' : 'credits'} per{' '}
          {feature === 'aiAssistant' ? 'question' : 'scan'}. Failed requests are refunded.
        </p>
        {remaining !== null && remaining < cost && (
          <p className="text-ink-gold mt-1">
            Your allowance is used up. Credits reset on the first day of next month.
          </p>
        )}
      </div>
      <Link
        href="/settings/plans"
        className="text-ink-green inline-flex min-h-9 items-center font-semibold underline underline-offset-4"
      >
        View plan &amp; usage
      </Link>
    </div>
  );
}
