// ---------- Admin console types (admin spec Section 4) ----------

import type { AssistantReply, Crop, Profile } from '@/types';

export type AdminRole = 'analyst' | 'support' | 'admin' | 'super_admin';
export type Role = 'farmer' | AdminRole;
export type AccountStatus = 'active' | 'suspended' | 'pending_verification';

/** Admin spec Section 2. The role → permission matrix lives in `lib/admin/permissions.ts`. */
export type Permission =
  | 'overview.view'
  | 'farmers.view'
  | 'farmers.edit'
  | 'farmers.suspend'
  | 'farmers.delete'
  | 'farmers.impersonate'
  | 'verifications.review'
  | 'loans.view'
  | 'loans.manage'
  | 'lenders.manage'
  | 'credit.configure'
  | 'content.manage'
  | 'announcements.send'
  | 'risk.review'
  | 'reports.export'
  | 'admins.manage'
  | 'audit.view'
  | 'settings.manage'
  | 'data.manage';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  createdBy?: string;
}

/** The admin's view of a farmer. */
export interface FarmerAccount {
  userId: string;
  email: string;
  isGuest: boolean;
  status: AccountStatus;
  suspendedReason?: string;
  createdAt: string;
  lastActiveAt?: string;
  profile: Profile;
  stats: {
    records: number;
    momo: number;
    income: number;
    expenses: number;
    score: number;
    diagnoses: number;
  };
  /** e.g. 'cooperative-lead', 'pilot-2026' */
  tags: string[];
  adminNotes: { id: string; text: string; by: string; at: string }[];
}

export type VerificationKind = 'phone' | 'location' | 'ghanaCard';

export interface VerificationRequest {
  id: string;
  userId: string;
  kind: VerificationKind;
  /** Masked for ghanaCard. */
  submittedValue: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reason?: string;
}

export type LoanStatus =
  'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'repaid' | 'defaulted';

/**
 * The admin's view of a loan application, with a status history. The farmer app's own
 * `LoanApplication` in `@/types` (status always 'submitted') is reconciled with this in A3.
 */
export interface LoanApplication {
  id: string;
  /** e.g. APP-2026-48213 */
  reference: string;
  userId: string;
  partnerId: string;
  amount: number;
  months: number;
  purpose: string;
  rate: number;
  monthly: number;
  scoreAtApplication: number;
  status: LoanStatus;
  history: { status: LoanStatus; by: string; at: string; note?: string }[];
  createdAt: string;
}

export interface CreditConfig {
  version: number;
  /** Must sum to 100. */
  weights: {
    paymentHistory: number;
    recordCompleteness: number;
    incomeStability: number;
    momoActivity: number;
    verification: number;
  };
  targets: { recordsForFull: number; momoForFull: number; monthsWindow: number };
  /** Score thresholds, e.g. 500 / 650 / 750. */
  bands: { fair: number; good: number; excellent: number };
  eligibility: { minRecords: number; minScore: number; maxProfitMultiplier: number };
  updatedAt: string;
  updatedBy: string;
}

export interface FeatureFlags {
  signupOpen: boolean;
  guestMode: boolean;
  aiAssistant: boolean;
  cropDoctor: boolean;
  yieldPredictor: boolean;
  loans: boolean;
  market: boolean;
  pdfReports: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export interface Plan {
  id: 'free' | 'premium';
  name: string;
  priceGHS: number;
  features: string[];
  active: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  audience:
    { kind: 'all' } | { kind: 'region'; regions: string[] } | { kind: 'crop'; crops: Crop[] };
  startsAt: string;
  endsAt?: string;
  active: boolean;
  dismissible: boolean;
  createdBy: string;
  createdAt: string;
}

export type RiskRuleId =
  | 'duplicate_momo_ref'
  | 'amount_outlier'
  | 'burst_entries'
  | 'income_spike'
  | 'shared_phone'
  | 'shared_ghana_card'
  | 'backdated_bulk';

export interface RiskFlag {
  id: string;
  userId: string;
  rule: RiskRuleId;
  severity: 'low' | 'medium' | 'high';
  description: string;
  relatedIds: string[];
  status: 'open' | 'dismissed' | 'confirmed';
  detectedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
}

export interface AssistantKnowledgeItem {
  id: string;
  keywords: string[];
  reply: AssistantReply;
  active: boolean;
  priority: number;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: AdminRole;
  /** e.g. 'farmer.suspend', 'credit.update' */
  action: string;
  targetType:
    | 'farmer'
    | 'loan'
    | 'lender'
    | 'config'
    | 'content'
    | 'announcement'
    | 'risk'
    | 'admin'
    | 'system';
  targetId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}
