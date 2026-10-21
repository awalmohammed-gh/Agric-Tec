// Reads a farmer's own per-user keys and builds the admin's view of them (FarmerAccount).
// Synchronous on purpose: the services add the async boundary and latency.

import { calculateCreditScore } from '@/lib/calculations/credit-score';
import { totalExpenses, totalIncome } from '@/lib/calculations/finance';
import { DEFAULT_CREDIT_CONFIG } from '@/lib/admin/defaults';
import { FARMER_ADMIN_META, FARMER_DATA, PLATFORM_KEYS } from '@/lib/admin/keys';
import type { RiskSubject } from '@/lib/admin/risk-rules';
import { safeProfile } from '@/lib/profile';
import { USERS_KEY, type StoredUser } from '@/services/auth.service';
import { defaultProfile } from '@/services/profile.service';
import { storage, userKey } from '@/services/storage';
import type { Diagnosis, FarmRecord, MomoTransaction, Profile } from '@/types';
import type { CreditConfig, FarmerAccount } from '@/types/admin';

export interface FarmerAdminMeta {
  tags: string[];
  adminNotes: FarmerAccount['adminNotes'];
}

export interface FarmerData {
  profile: Profile;
  records: FarmRecord[];
  momo: MomoTransaction[];
  diagnoses: Diagnosis[];
  meta: FarmerAdminMeta;
}

const readCreditConfig = () =>
  storage.get<CreditConfig>(PLATFORM_KEYS.creditConfig, DEFAULT_CREDIT_CONFIG);

export const readUsers = (): StoredUser[] => storage.get<StoredUser[]>(USERS_KEY, []);
export const writeUsers = (users: StoredUser[]): void => storage.set(USERS_KEY, users);

/** Same merge as profileService.get, so the admin sees exactly what the farmer sees. */
export function readProfile(userId: string): Profile {
  const saved = storage.get<Profile | null>(userKey(userId, FARMER_DATA.profile), null);
  const base = defaultProfile(userId);
  return safeProfile(
    saved
      ? { ...base, ...saved, userId, verification: { ...base.verification, ...saved.verification } }
      : base,
  );
}

export const writeProfile = (profile: Profile): void =>
  storage.set(userKey(profile.userId, FARMER_DATA.profile), safeProfile(profile));

export const readMeta = (userId: string): FarmerAdminMeta => ({
  tags: [],
  adminNotes: [],
  ...storage.get<Partial<FarmerAdminMeta>>(userKey(userId, FARMER_ADMIN_META), {}),
});

export const writeMeta = (userId: string, meta: FarmerAdminMeta): void =>
  storage.set(userKey(userId, FARMER_ADMIN_META), meta);

export function readFarmerData(userId: string): FarmerData {
  return {
    profile: readProfile(userId),
    records: storage.get<FarmRecord[]>(userKey(userId, FARMER_DATA.records), []),
    momo: storage.get<MomoTransaction[]>(userKey(userId, FARMER_DATA.momo), []),
    diagnoses: storage.get<Diagnosis[]>(userKey(userId, FARMER_DATA.diagnoses), []),
    meta: readMeta(userId),
  };
}

/** The newest of the stored activity time and the farmer's latest entry. */
function lastActive(user: StoredUser, data: FarmerData): string | undefined {
  const times = [
    user.lastActiveAt,
    ...data.records.map((r) => r.createdAt),
    ...data.momo.map((t) => t.createdAt),
  ].filter((t): t is string => Boolean(t));
  return times.length ? times.reduce((a, b) => (b > a ? b : a)) : undefined;
}

export function buildFarmerAccount(
  user: StoredUser,
  data = readFarmerData(user.id),
): FarmerAccount {
  return {
    userId: user.id,
    email: user.email,
    isGuest: user.isGuest,
    status: user.status ?? 'active',
    ...(user.suspendedReason && { suspendedReason: user.suspendedReason }),
    createdAt: user.createdAt,
    lastActiveAt: lastActive(user, data),
    profile: data.profile,
    stats: {
      records: data.records.length,
      momo: data.momo.length,
      income: totalIncome(data.records),
      expenses: totalExpenses(data.records),
      // The live credit rules, so admins see the same score the farmer sees.
      score: calculateCreditScore(data.records, data.momo, data.profile, readCreditConfig()).score,
      diagnoses: data.diagnoses.length,
    },
    tags: data.meta.tags,
    adminNotes: data.meta.adminNotes,
  };
}

/** Every farmer as a risk-rule input. Guests are included: fraud can start there too. */
export function readRiskSubjects(): RiskSubject[] {
  return readUsers().map((user) => {
    const { profile, records, momo } = readFarmerData(user.id);
    return { userId: user.id, profile, records, momo };
  });
}
