// DEMO ONLY: subscriptions, receipts and credits are local to this browser.
// Live billing must use server-verified payments and server-side entitlement/usage checks.
import { AI_COSTS, FEATURE_NAMES, isPlanId, planAccess } from '@/lib/subscriptions/plans';
import { generateId } from '@/lib/utils';
import { readFlags, readPlans } from '@/services/admin/config.service';
import { READ_ONLY_MESSAGE, storage, userKey } from '@/services/storage';
import type {
  CreditReservation,
  MockPaymentMethod,
  PlanFeature,
  PlanId,
  Subscription,
  SubscriptionSnapshot,
} from '@/types/subscription';

interface Usage {
  month: string;
  used: number;
  pending: Record<string, { cost: number; at: string }>;
}
const subKey = (id: string) => userKey(id, 'subscription');
const usageKey = (id: string) => userKey(id, 'ai-usage');
const free = (userId: string): Subscription => ({
  userId,
  planId: 'free',
  mode: 'mock',
  startsAt: null,
  expiresAt: null,
});

function persist(key: string, value: unknown) {
  if (storage.isReadOnly()) throw new Error(READ_ONLY_MESSAGE);
  storage.set(key, value);
  if (
    typeof window !== 'undefined' &&
    JSON.stringify(storage.get(key, null)) !== JSON.stringify(value)
  )
    throw new Error(
      'Could not save your subscription or usage. Check device storage and try again.',
    );
}

function readSubscription(userId: string, now: Date): Subscription {
  const saved = storage.get<Subscription | null>(subKey(userId), null);
  if (!saved || saved.userId !== userId || !isPlanId(saved.planId) || saved.mode !== 'mock')
    return free(userId);
  if (saved.planId === 'free') return saved;
  if (
    !saved.expiresAt ||
    !saved.startsAt ||
    !Number.isFinite(Date.parse(saved.startsAt)) ||
    Date.parse(saved.startsAt) > now.getTime() ||
    !Number.isFinite(Date.parse(saved.expiresAt)) ||
    Date.parse(saved.expiresAt) <= now.getTime()
  )
    return { ...free(userId), payment: saved.payment };
  return saved;
}

function usage(userId: string, now: Date): Usage {
  const month = now.toISOString().slice(0, 7);
  const saved = storage.get<Usage | null>(usageKey(userId), null);
  if (!saved || saved.month !== month || !Number.isFinite(saved.used) || saved.used < 0)
    return { month, used: 0, pending: {} };
  const next: Usage = { month, used: saved.used, pending: {} };
  for (const [id, hold] of Object.entries(saved.pending ?? {})) {
    if (!hold || !Number.isFinite(hold.cost) || hold.cost <= 0) continue;
    if (Date.parse(hold.at) + 10 * 60_000 <= now.getTime())
      next.used = Math.max(0, next.used - hold.cost);
    else next.pending[id] = hold;
  }
  return next;
}

/** Same day next month, clamped to the month's final day. No automatic renewal. */
export function nextBillingDate(now: Date): Date {
  const date = new Date(now);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(now.getUTCDate(), last));
  return date;
}

export const subscriptionService = {
  get(userId: string, now = new Date()): SubscriptionSnapshot {
    const subscription = readSubscription(userId, now);
    const plan = readPlans().find((p) => p.id === subscription.planId)!;
    const creditsLimit =
      subscription.planId === 'advanced'
        ? null
        : subscription.planId === 'premium'
          ? (plan.aiCredits ?? 100)
          : 0;
    const creditsUsed = usage(userId, now).used;
    return {
      subscription,
      creditsUsed,
      creditsLimit,
      creditsRemaining: creditsLimit === null ? null : Math.max(0, creditsLimit - creditsUsed),
      resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    };
  },

  assertFeature(userId: string, feature: PlanFeature, now = new Date()) {
    if (!readFlags()[feature])
      throw new Error(`${FEATURE_NAMES[feature]} is currently unavailable.`);
    const snapshot = this.get(userId, now);
    const plan = readPlans().find((p) => p.id === snapshot.subscription.planId)!;
    if (!planAccess(plan)[feature])
      throw new Error(
        `${FEATURE_NAMES[feature]} is not included in ${plan.name}. View plans in Settings → Plans & billing.`,
      );
    return snapshot;
  },

  activateMock(
    userId: string,
    planId: PlanId,
    method: MockPaymentMethod,
    now = new Date(),
  ): SubscriptionSnapshot {
    if (storage.isReadOnly()) throw new Error(READ_ONLY_MESSAGE);
    const plan = readPlans().find((p) => p.id === planId);
    if (!plan || !plan.active) throw new Error('This plan is not available. Choose another plan.');
    if (!['mobile-money', 'card'].includes(method))
      throw new Error('Choose a demo payment method.');
    const subscription: Subscription = {
      ...free(userId),
      planId,
      payment: readSubscription(userId, now).payment,
      startsAt: planId === 'free' ? null : now.toISOString(),
      expiresAt: planId === 'free' ? null : nextBillingDate(now).toISOString(),
      ...(planId !== 'free' && {
        payment: {
          reference: `DEMO-${generateId()}`,
          planId,
          amountGHS: plan.priceGHS,
          method,
          createdAt: now.toISOString(),
          status: 'simulated' as const,
        },
      }),
    };
    persist(subKey(userId), subscription);
    // Switching or renewing a plan never resets this month's used credits.
    return this.get(userId, now);
  },

  reserve(userId: string, feature: keyof typeof AI_COSTS, now = new Date()): CreditReservation {
    const snapshot = this.assertFeature(userId, feature, now);
    const cost = AI_COSTS[feature];
    if (snapshot.creditsRemaining !== null && snapshot.creditsRemaining < cost)
      throw new Error(
        `Not enough AI credits for this ${feature === 'cropDoctor' ? 'scan' : 'question'}. Credits reset next month, or choose Advanced.`,
      );
    const current = usage(userId, now);
    const reservation: CreditReservation = { id: generateId(), userId, month: current.month, cost };
    current.used += cost;
    current.pending[reservation.id] = { cost, at: now.toISOString() };
    persist(usageKey(userId), current);
    return reservation;
  },

  settle(reservation: CreditReservation, success: boolean, now = new Date()): SubscriptionSnapshot {
    const current = usage(reservation.userId, now);
    const hold = current.pending[reservation.id];
    if (current.month === reservation.month && hold) {
      if (!success) current.used = Math.max(0, current.used - hold.cost);
      delete current.pending[reservation.id];
      persist(usageKey(reservation.userId), current);
    }
    return this.get(reservation.userId, now);
  },
};
