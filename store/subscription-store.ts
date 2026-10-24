import { create } from 'zustand';
import { assertWritable } from '@/lib/read-only';
import { delay } from '@/services/storage';
import { subscriptionService } from '@/services/subscription.service';
import type { LoadOptions, StoreStatus } from '@/types';
import type {
  CreditReservation,
  MockPaymentMethod,
  PlanId,
  SubscriptionSnapshot,
} from '@/types/subscription';

interface SubscriptionState {
  userId: string | null;
  snapshot: SubscriptionSnapshot | null;
  status: StoreStatus;
  load: (userId: string, options?: LoadOptions) => Promise<void>;
  refresh: () => void;
  checkoutMock: (planId: PlanId, method: MockPaymentMethod) => Promise<void>;
  reserveAi: (feature: 'aiAssistant' | 'cropDoctor') => CreditReservation;
  settleAi: (reservation: CreditReservation, success: boolean) => void;
  assertFeature: (feature: import('@/types/subscription').PlanFeature) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()((set, get) => {
  const requireUser = () => {
    const { userId, status } = get();
    if (!userId || status !== 'ready')
      throw new Error('Your plan is still loading. Please try again.');
    return userId;
  };
  return {
    userId: null,
    snapshot: null,
    status: 'idle',
    load: async (userId, { silent = false } = {}) => {
      if (!silent || get().userId !== userId) set({ userId, status: 'loading', snapshot: null });
      try {
        const snapshot = subscriptionService.get(userId);
        if (get().userId === userId) set({ snapshot, status: 'ready' });
      } catch (error) {
        if (get().userId === userId) set({ status: 'error' });
        throw error;
      }
    },
    refresh: () => {
      const { userId } = get();
      if (userId) set({ snapshot: subscriptionService.get(userId) });
    },
    checkoutMock: async (planId, method) => {
      assertWritable();
      const userId = requireUser();
      await delay(600);
      if (get().userId !== userId) throw new Error('Your session changed. Please try again.');
      const snapshot = subscriptionService.activateMock(userId, planId, method);
      set({ snapshot });
    },
    reserveAi: (feature) => {
      assertWritable();
      const userId = requireUser();
      const reservation = subscriptionService.reserve(userId, feature);
      get().refresh();
      return reservation;
    },
    settleAi: (reservation, success) => {
      const snapshot = subscriptionService.settle(reservation, success);
      if (get().userId === reservation.userId) set({ snapshot });
    },
    assertFeature: (feature) => {
      subscriptionService.assertFeature(requireUser(), feature);
    },
  };
});
