'use client';

import { useState } from 'react';
import { Check, CreditCard, Smartphone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useSubscription } from '@/hooks/use-subscription';
import { FEATURE_NAMES, normalizePlans, planAccess } from '@/lib/subscriptions/plans';
import { formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useReadOnly } from '@/lib/read-only';
import { usePlatformStore } from '@/store/platform-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import type { Plan } from '@/types/admin';
import type { MockPaymentMethod, PlanFeature } from '@/types/subscription';

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Accra',
  });

export function PlanManager() {
  const savedPlans = usePlatformStore((s) => s.plans);
  const plans = normalizePlans(savedPlans);
  const { plan: current, snapshot, ready } = useSubscription();
  const checkout = useSubscriptionStore((s) => s.checkoutMock);
  const readOnly = useReadOnly();
  const [selectedId, setSelectedId] = useState<Plan['id'] | null>(null);
  const [method, setMethod] = useState<MockPaymentMethod>('mobile-money');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = plans.find((p) => p.id === selectedId);
  const payment = snapshot?.subscription.payment;

  function choose(plan: Plan) {
    setConsent(false);
    setSelectedId(plan.id);
  }

  async function confirm() {
    if (!selected || !consent || busy || readOnly) return;
    setBusy(true);
    try {
      await checkout(selected.id, method);
      setSelectedId(null);
      toast.success(
        selected.id === 'free' ? 'Switched to Free' : `${selected.name} activated in demo mode`,
        { description: 'No money was charged.' },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not activate this plan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="border-gold/30 bg-gold/10 text-text-dim rounded-2xl border p-4 text-sm">
        <p className="text-text font-semibold">Demo payments · no money is charged</p>
        <p className="mt-1">
          Try a subscription with a simulated mobile money or card payment. No payment details are
          collected. Plans and usage are saved on this device.
        </p>
      </div>
      <Card className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-text-mute text-xs">Your current plan</p>
            <h3 className="text-ink-green font-display mt-1 text-2xl font-bold">{current.name}</h3>
            {snapshot?.subscription.expiresAt && (
              <p className="text-text-dim mt-2 text-xs">
                Active until {dateLabel(snapshot.subscription.expiresAt)}. No automatic renewal.
              </p>
            )}
          </div>
          <Badge color="gold">Mock subscription</Badge>
        </div>
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-text text-sm font-semibold">
            {snapshot?.creditsRemaining === null
              ? 'Unlimited AI credits'
              : `${snapshot?.creditsRemaining ?? 0} AI credits remaining`}
          </p>
          <p className="text-text-mute mt-1 text-xs">
            One assistant question uses 1 credit. One crop scan uses 5. Yield estimates and PDFs use
            no credits.
          </p>
          <p className="text-text-mute mt-1 text-xs">
            Premium includes {plans.find((p) => p.id === 'premium')?.aiCredits ?? 100} credits
            shared across questions and scans. Credits reset on the first day of each month;
            changing plans does not reset usage.
          </p>
          {snapshot && (
            <p className="text-text-mute mt-1 text-xs">
              Used this month: {snapshot.creditsUsed}. Next reset: {dateLabel(snapshot.resetsAt)}.
            </p>
          )}
        </div>
      </Card>
      <div>
        <h3 className="text-text text-lg font-bold">Choose what fits your farm</h3>
        <p className="text-text-dim mt-1 text-sm">
          All plans keep your farm records, MoMo tracking, credit score, loan comparisons and market
          information.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
        {plans
          .filter((p) => p.active || p.id === current.id)
          .map((plan) => {
            const access = planAccess(plan);
            const isCurrent = plan.id === current.id;
            return (
              <article
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-3xl border p-5',
                  plan.id === 'premium' ? 'border-accent/50 bg-accent/5' : 'border-border bg-glass',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-text font-display text-xl font-bold">{plan.name}</h4>
                  {isCurrent ? (
                    <Badge color="green">Current plan</Badge>
                  ) : plan.id === 'premium' ? (
                    <Badge color="purple">For growing farms</Badge>
                  ) : null}
                </div>
                <p className="text-text mt-3 text-3xl font-bold">
                  {formatGHS(plan.priceGHS)}
                  <span className="text-text-mute text-sm font-normal"> / month</span>
                </p>
                <p className="text-text-dim mt-3 text-sm">
                  {plan.id === 'advanced'
                    ? 'Unlimited AI credits'
                    : plan.id === 'premium'
                      ? `${plan.aiCredits ?? 100} AI credits / month`
                      : 'AI tools not included'}
                </p>
                <p className="text-text-mute mt-2 text-xs leading-relaxed">
                  {plan.features.join(' · ')}
                </p>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {(Object.keys(FEATURE_NAMES) as PlanFeature[]).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      {access[feature] ? (
                        <Check size={16} className="text-ink-green shrink-0" aria-hidden="true" />
                      ) : (
                        <span className="text-text-mute w-4 text-center" aria-hidden="true">
                          −
                        </span>
                      )}
                      <span className={access[feature] ? 'text-text' : 'text-text-mute'}>
                        {FEATURE_NAMES[feature]}
                        {!access[feature] && ' not included'}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  icon={Sparkles}
                  variant={plan.id === 'premium' ? 'primary' : 'ghost'}
                  className="mt-5 w-full"
                  mutates
                  disabled={!ready || readOnly || isCurrent || !plan.active}
                  onClick={() => choose(plan)}
                >
                  {isCurrent
                    ? 'Your current plan'
                    : plan.id === 'free'
                      ? 'Switch to Free'
                      : `Choose ${plan.name}`}
                </Button>
              </article>
            );
          })}
      </div>
      {payment && (
        <Card className="rounded-2xl">
          <h3 className="text-text font-semibold">Latest demo receipt</h3>
          <dl className="text-text-dim mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-text-mute">Status</dt>
              <dd>Simulated — no money charged</dd>
            </div>
            <div>
              <dt className="text-text-mute">Plan / amount</dt>
              <dd>
                {plans.find((p) => p.id === payment.planId)?.name} · {formatGHS(payment.amountGHS)}
              </dd>
            </div>
            <div>
              <dt className="text-text-mute">Reference</dt>
              <dd className="font-mono text-xs break-all">{payment.reference}</dd>
            </div>
            <div>
              <dt className="text-text-mute">Date</dt>
              <dd>{dateLabel(payment.createdAt)}</dd>
            </div>
          </dl>
        </Card>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          if (!busy) setSelectedId(null);
        }}
        title={selected?.id === 'free' ? 'Switch to Free' : 'Mock checkout'}
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            <p className="text-text font-semibold">
              {selected.name} · {formatGHS(selected.priceGHS)} per month
            </p>
            <p className="text-text-dim text-sm">
              {selected.id === 'free'
                ? 'Paid tools will lock immediately. Your saved farm data stays available.'
                : 'This is a payment simulation. Do not enter real card or mobile money details. Your demo plan lasts one month and does not renew automatically.'}
            </p>
            {selected.id !== 'free' && (
              <fieldset>
                <legend className="text-text mb-2 text-sm font-semibold">
                  Demo payment method
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {(['mobile-money', 'card'] as const).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        'flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm',
                        method === option ? 'border-accent bg-accent/10' : 'border-border',
                      )}
                    >
                      <input
                        type="radio"
                        name="mock-payment-method"
                        value={option}
                        checked={method === option}
                        disabled={busy}
                        onChange={() => setMethod(option)}
                      />
                      {option === 'card' ? (
                        <CreditCard size={16} aria-hidden="true" />
                      ) : (
                        <Smartphone size={16} aria-hidden="true" />
                      )}
                      {option === 'card' ? 'Card' : 'Mobile money'}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="text-text-dim flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1"
              />
              {selected.id === 'free'
                ? 'I understand paid features will become unavailable.'
                : 'I understand this simulates a payment and no money will be taken.'}
            </label>
            <Button
              mutates
              disabled={!consent || readOnly}
              loading={busy}
              onClick={() => void confirm()}
              className="w-full whitespace-normal"
            >
              {selected.id === 'free'
                ? 'Confirm switch to Free'
                : `Simulate ${formatGHS(selected.priceGHS)} payment`}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
