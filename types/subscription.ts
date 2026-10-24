export type PlanId = 'free' | 'basic' | 'premium' | 'advanced';
export type PlanFeature = 'pdfReports' | 'aiAssistant' | 'cropDoctor' | 'yieldPredictor';
export type PlanAccess = Record<PlanFeature, boolean>;
export type MockPaymentMethod = 'mobile-money' | 'card';

export interface MockPayment {
  reference: string;
  planId: PlanId;
  amountGHS: number;
  method: MockPaymentMethod;
  createdAt: string;
  status: 'simulated';
}

export interface Subscription {
  userId: string;
  planId: PlanId;
  mode: 'mock';
  startsAt: string | null;
  expiresAt: string | null;
  payment?: MockPayment;
}

export interface CreditReservation {
  id: string;
  userId: string;
  month: string;
  cost: number;
}

export interface SubscriptionSnapshot {
  subscription: Subscription;
  creditsUsed: number;
  creditsLimit: number | null;
  creditsRemaining: number | null;
  resetsAt: string;
}
