import type { Profile } from '@/types';

export const ghanaPhone = /^(\+233|0)[235]\d{8}$/;
export const ghanaCard = /^GHA-\d{9}-\d$/;

export function normalizePhone(phone: string): string {
  const value = phone.trim();
  return value.startsWith('0') ? `+233${value.slice(1)}` : value;
}

export function formatGhanaCard(value: string): string {
  const digits = value
    .toUpperCase()
    .replace(/^GHA-?/, '')
    .replace(/\D/g, '')
    .slice(0, 10);
  return digits ? `GHA-${digits.slice(0, 9)}${digits.length > 9 ? `-${digits[9]}` : ''}` : '';
}

/** Four trailing digits including the check digit; the full identifier is never persisted. */
export function maskGhanaCard(last4?: string): string {
  return last4 && /^\d{4}$/.test(last4)
    ? `GHA-******${last4.slice(0, 3)}-${last4[3]}`
    : 'Not verified';
}

export function profileCompleteness(profile: Profile | null): number {
  if (!profile) return 0;
  const fields = [
    profile.name.trim(),
    profile.phone,
    profile.email,
    profile.region,
    profile.farmName.trim(),
    profile.acres > 0,
    profile.primaryCrops.length > 0,
    profile.verification.phone,
    profile.verification.location,
    profile.verification.ghanaCard,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

/** Whitelist persisted profile fields, excluding any raw identity number or unknown properties. */
export function safeProfile(profile: Profile): Profile {
  return {
    userId: profile.userId,
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    region: profile.region,
    farmName: profile.farmName,
    acres: profile.acres,
    farmType: profile.farmType,
    primaryCrops: [...profile.primaryCrops],
    verification: {
      phone: Boolean(profile.verification.phone),
      location: Boolean(profile.verification.location),
      ghanaCard: Boolean(profile.verification.ghanaCard),
    },
    ...(profile.gps && { gps: { lat: profile.gps.lat, lng: profile.gps.lng } }),
    ...(profile.ghanaCardLast4 &&
      /^\d{4}$/.test(profile.ghanaCardLast4) && { ghanaCardLast4: profile.ghanaCardLast4 }),
  };
}
