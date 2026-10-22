// The onboarding wizard's storage: a draft saved on every Continue (so a farmer resumes where
// they stopped) and the final save that opens the app. Same localStorage layer as the rest.

import { onboardingProfileSchema } from '@/components/onboarding/onboarding-schemas';
import { safeProfile } from '@/lib/profile';
import { verificationsService } from '@/services/admin/verifications.service';
import { profileService } from '@/services/profile.service';
import { delay, storage, userKey } from '@/services/storage';
import type { OnboardingDraft, Profile } from '@/types';

const ONBOARDED_COOKIE = 'agrictec_onboarded';
const draftKey = (userId: string) => userKey(userId, 'onboarding-draft');

/**
 * A redirect hint for proxy.ts only (anyone can set it by hand): the DataLoader checks the
 * profile itself before showing the app.
 */
export function setOnboardedCookie(onboarded: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = onboarded
    ? `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`
    : `${ONBOARDED_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Fields the draft may hold: never a raw Ghana Card number (only its mask and hash). */
function cleanDraftData(data: Partial<Profile>): Partial<Profile> {
  const { ghanaCard, ...rest } = data;
  return {
    ...rest,
    ...(ghanaCard && {
      ghanaCard: {
        status: ghanaCard.status,
        ...(ghanaCard.masked && { masked: ghanaCard.masked }),
        ...(ghanaCard.hash && { hash: ghanaCard.hash }),
      },
    }),
  };
}

export const onboardingService = {
  async getDraft(userId: string): Promise<OnboardingDraft | null> {
    await delay(0);
    return storage.get<OnboardingDraft | null>(draftKey(userId), null);
  },

  async saveDraft(userId: string, currentStep: number, data: Partial<Profile>) {
    await delay(0);
    const draft: OnboardingDraft = {
      userId,
      currentStep,
      data: cleanDraftData(data),
      updatedAt: new Date().toISOString(),
    };
    storage.set(draftKey(userId), draft);
    return draft;
  },

  async clearDraft(userId: string): Promise<void> {
    await delay(0);
    storage.remove(draftKey(userId));
  },

  /** Whether this farmer has finished onboarding (also refreshes the proxy cookie). */
  async isComplete(userId: string): Promise<boolean> {
    const profile = await profileService.get(userId);
    const done = Boolean(profile.onboardingCompletedAt);
    setOnboardedCookie(done);
    return done;
  },

  /** Where to go after signing in: the requested page when onboarded, otherwise onboarding. */
  async destinationAfterSignIn(userId: string, next: string): Promise<string> {
    return (await onboardingService.isComplete(userId)) ? next : '/onboarding';
  },

  /**
   * Saves the whole profile and opens the app: onboardingCompletedAt, location verified when a
   * pin is set, and a Ghana Card sent to the admin's verifications queue (pending: an admin
   * approves it; verification.ghanaCard turns true only then). Clears the draft.
   */
  async complete(userId: string, data: Partial<Profile>): Promise<Profile> {
    const current = await profileService.get(userId);
    const merged: Profile = {
      ...current,
      ...data,
      userId,
      name: current.name || data.name || '',
      email: current.email || data.email || '',
    };
    const check = onboardingProfileSchema.safeParse(merged);
    if (!check.success)
      throw new Error(check.error.issues[0]?.message ?? 'Some answers are missing.');

    const card = merged.ghanaCard;
    const sendCard = card.status === 'pending' && card.masked && card.hash;
    const profile = await profileService.save(
      userId,
      safeProfile({
        ...merged,
        // A card is "pending" until its request is queued below (which writes the same status).
        ghanaCard: sendCard ? card : { status: 'not_provided' },
        verification: {
          ...merged.verification,
          location: Boolean(merged.gps) || merged.verification.location,
        },
        onboardingCompletedAt: new Date().toISOString(),
      }),
    );
    if (sendCard && card.masked && card.hash) {
      await verificationsService.submitCardFingerprint(userId, card.masked, card.hash);
    }
    await onboardingService.clearDraft(userId);
    setOnboardedCookie(true);
    return sendCard ? profileService.get(userId) : profile;
  },
};
