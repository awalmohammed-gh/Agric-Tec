// Everything the farmer app reads from the admin console's settings, in one place:
// credit rules, feature flags, plans, lenders, content and announcements. All reads are public
// (no admin permission); the admin services own the writes.

import { announcementsService } from '@/services/admin/announcements.service';
import { configService } from '@/services/admin/config.service';
import { contentService } from '@/services/admin/content.service';
import { lendersService } from '@/services/admin/lenders.service';
import { riskService } from '@/services/admin/risk.service';
import { verificationsService } from '@/services/admin/verifications.service';
import { delay, storage, userKey } from '@/services/storage';
import type { MarketPrice, Weather } from '@/types';
import type {
  Announcement,
  AssistantKnowledgeItem,
  CreditConfig,
  CropContent,
  DiagnosisContent,
  FeatureFlags,
  Lender,
  Plan,
  VerificationRequest,
} from '@/types/admin';

export interface PlatformSnapshot {
  creditConfig: CreditConfig;
  flags: FeatureFlags;
  plans: Plan[];
  /** Lenders accepting applications. */
  lenders: Lender[];
  /** Every lender, including switched-off ones (to name them on older applications). */
  allLenders: Lender[];
  marketPrices: MarketPrice[];
  weatherOverride: Weather | null;
  crops: CropContent[];
  knowledge: AssistantKnowledgeItem[];
  diagnoses: DiagnosisContent[];
  /** Live announcements for every audience; the banner picks the farmer's own. */
  announcements: Announcement[];
}

/** Announcements this farmer closed, stored with their own data. */
const dismissedKey = (userId: string) => userKey(userId, 'dismissed-announcements');

export const platformService = {
  async getFlags(): Promise<FeatureFlags> {
    return configService.getFlags();
  },

  /** Loads every platform setting in parallel. */
  async load(): Promise<PlatformSnapshot> {
    const [
      creditConfig,
      flags,
      plans,
      allLenders,
      marketPrices,
      weatherOverride,
      crops,
      knowledge,
      diagnoses,
      announcements,
    ] = await Promise.all([
      configService.getCreditConfig(),
      configService.getFlags(),
      configService.getPlans(),
      lendersService.list({ includeInactive: true }),
      contentService.getMarketPrices(),
      contentService.getWeatherOverride(),
      contentService.getCrops(),
      contentService.getAssistantKb(),
      contentService.getDiagnoses(),
      announcementsService.listLive(),
    ]);
    return {
      creditConfig,
      flags,
      plans,
      lenders: allLenders.filter((l) => l.active),
      allLenders,
      marketPrices,
      weatherOverride,
      crops,
      knowledge,
      diagnoses,
      announcements,
    };
  },

  async getDismissed(userId: string): Promise<string[]> {
    await delay(0);
    return storage.get<string[]>(dismissedKey(userId), []);
  },

  /** Remembers a dismissal for this farmer only. Old IDs are pruned as announcements expire. */
  async dismiss(userId: string, id: string, liveIds: string[]): Promise<string[]> {
    await delay(0);
    const kept = storage
      .get<string[]>(dismissedKey(userId), [])
      .filter((known) => liveIds.includes(known));
    const next = kept.includes(id) ? kept : [...kept, id];
    storage.set(dismissedKey(userId), next);
    return next;
  },

  /** Whether an admin confirmed a risk flag on this account (no details, just the state). */
  async underReview(userId: string): Promise<boolean> {
    return riskService.underReview(userId);
  },

  async listVerifications(userId: string): Promise<VerificationRequest[]> {
    return verificationsService.listForFarmer(userId);
  },

  /** Sends a Ghana Card for admin review. Only a masked number is stored. */
  async submitGhanaCard(userId: string, cardNumber: string): Promise<VerificationRequest> {
    return verificationsService.submit(userId, 'ghanaCard', cardNumber);
  },

  /** Phone and location pass instantly; this logs the approved check for the admin's records. */
  async logInstantCheck(
    userId: string,
    kind: 'phone' | 'location',
    value: string,
  ): Promise<VerificationRequest> {
    return verificationsService.submit(userId, kind, value);
  },
};
