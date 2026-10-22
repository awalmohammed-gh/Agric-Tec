import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { hashGhanaCard } from '@/lib/admin/card-hash';
import { canBulkApprove, isRejectReason, parseLocation } from '@/lib/admin/verification-queue';
import { rejectionMessage } from '@/lib/verification';
import { readProfile, readUsers, writeProfile, writeUsers } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { ghanaCard, ghanaPhone, maskGhanaCard, normalizePhone } from '@/lib/profile';
import { generateId } from '@/lib/utils';
import { delay, storage } from '@/services/storage';
import type { VerificationFilter, VerificationKind, VerificationRequest } from '@/types/admin';

const KIND_LABELS: Record<VerificationKind, string> = {
  phone: 'phone',
  location: 'location',
  ghanaCard: 'Ghana Card',
};

const read = () => storage.get<VerificationRequest[]>(PLATFORM_KEYS.verifications, []);
const write = (items: VerificationRequest[]) => storage.set(PLATFORM_KEYS.verifications, items);

function find(id: string): VerificationRequest {
  const request = read().find((v) => v.id === id);
  if (!request) throw new Error('Verification request not found.');
  return request;
}

const save = (updated: VerificationRequest) =>
  write(read().map((v) => (v.id === updated.id ? updated : v)));

/** Marks the check as passed on the farmer's profile (and lifts a pending-verification status). */
function applyToProfile(request: VerificationRequest): void {
  const profile = readProfile(request.userId);
  const card = request.kind === 'ghanaCard';
  // Phone and location are saved by the farmer's own profile store first; rewriting an already
  // verified profile here could race that save, so only write when something changes.
  const changed =
    !profile.verification[request.kind] ||
    (card && profile.ghanaCard.masked !== request.submittedValue);
  // An approved location also fills in the farm's coordinates if the profile has none yet.
  const gps =
    request.kind === 'location' && !profile.gps ? parseLocation(request.submittedValue) : null;
  if (changed || gps)
    writeProfile({
      ...profile,
      verification: { ...profile.verification, [request.kind]: true },
      ...(card && {
        ghanaCard: {
          status: 'verified',
          masked: request.submittedValue,
          ...(request.valueHash && { hash: request.valueHash }),
          submittedAt: request.submittedAt,
        },
      }),
      ...(gps && { gps }),
    });
  if (request.kind === 'ghanaCard') {
    writeUsers(
      readUsers().map((u) =>
        u.id === request.userId && u.status === 'pending_verification'
          ? { ...u, status: 'active' }
          : u,
      ),
    );
  }
}

const farmerName = (userId: string) => readProfile(userId).name || 'a farmer';

/** The card on the profile follows its latest request: pending, or rejected with the reason. */
function setProfileCard(request: VerificationRequest): void {
  const profile = readProfile(request.userId);
  writeProfile({
    ...profile,
    ghanaCard: {
      status: request.status === 'rejected' ? 'rejected' : 'pending',
      masked: request.submittedValue,
      ...(request.valueHash && { hash: request.valueHash }),
      submittedAt: request.submittedAt,
      ...(request.status === 'rejected' && { rejectedReason: rejectionMessage(request) }),
    },
  });
}

const MASKED_CARD = /^GHA-\*{6}\d{3}-\d$/;

/** Queues a Ghana Card for review from its mask and hash (the full number is never stored). */
function queueCard(userId: string, masked: string, valueHash?: string): VerificationRequest {
  if (!MASKED_CARD.test(masked)) throw new Error('Enter a valid Ghana Card number.');
  if (read().some((v) => v.userId === userId && v.kind === 'ghanaCard' && v.status === 'pending'))
    throw new Error('Your Ghana Card is already waiting for review.');
  const request: VerificationRequest = {
    id: generateId(),
    userId,
    kind: 'ghanaCard',
    submittedValue: masked,
    ...(valueHash && { valueHash }),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  write([request, ...read()]);
  setProfileCard(request);
  return request;
}

export const verificationsService = {
  /** A farmer's own requests, newest first (called by the farmer app, so no admin check). */
  async listForFarmer(userId: string): Promise<VerificationRequest[]> {
    await delay();
    return read()
      .filter((v) => v.userId === userId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },

  /** Newest first. */
  async list(filter: VerificationFilter = {}): Promise<VerificationRequest[]> {
    await delay();
    requirePermission('verifications.review');
    return read()
      .filter(
        (v) =>
          (!filter.status || v.status === filter.status) &&
          (!filter.kind || v.kind === filter.kind) &&
          (!filter.userId || v.userId === filter.userId),
      )
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },

  /**
   * Called by the farmer app. Phone and location checks pass instantly (with an approved record);
   * a Ghana Card stays pending until an admin approves it. Only a masked card number is stored.
   */
  async submit(
    userId: string,
    kind: VerificationKind,
    value: string,
  ): Promise<VerificationRequest> {
    await delay();
    let submittedValue: string;
    if (kind === 'ghanaCard') {
      const trimmed = value.trim().toUpperCase();
      const full = ghanaCard.test(trimmed);
      const last4 = full
        ? trimmed.replace(/\D/g, '').slice(-4)
        : /^\d{4}$/.test(trimmed)
          ? trimmed
          : '';
      if (!last4) throw new Error('Enter a Ghana Card number such as GHA-123456789-0.');
      // Only a hash of the full number is kept, for the reviewer's duplicate check.
      return queueCard(
        userId,
        maskGhanaCard(last4),
        full ? await hashGhanaCard(trimmed) : undefined,
      );
    } else if (kind === 'phone') {
      if (!ghanaPhone.test(value.trim())) throw new Error('Enter a valid Ghana phone number.');
      submittedValue = normalizePhone(value);
    } else {
      if (!value.trim()) throw new Error('Location is required.');
      submittedValue = value.trim();
    }

    const now = new Date().toISOString();
    const request: VerificationRequest = {
      id: generateId(),
      userId,
      kind,
      submittedValue,
      status: 'approved',
      submittedAt: now,
      reviewedBy: 'Automatic check',
      reviewedAt: now,
    };
    write([request, ...read()]);
    applyToProfile(request);
    return request;
  },

  /**
   * Onboarding's Ghana Card: the browser sends only the masked number and the SHA-256 hash it
   * computed, so the full number never reaches storage. Pending until an admin approves it.
   */
  async submitCardFingerprint(
    userId: string,
    masked: string,
    valueHash: string,
  ): Promise<VerificationRequest> {
    await delay();
    return queueCard(userId, masked, valueHash);
  },

  async approve(id: string): Promise<VerificationRequest> {
    await delay();
    const request = find(id);
    return withAudit(
      {
        permission: 'verifications.review',
        action: 'verification.approve',
        targetType: 'farmer',
        targetId: request.userId,
        summary: `Approved the ${KIND_LABELS[request.kind]} check for ${farmerName(request.userId)}`,
        before: { status: request.status },
        after: (r) => ({ status: r.status }),
      },
      async () => {
        if (request.status !== 'pending')
          throw new Error('This request has already been reviewed.');
        const updated: VerificationRequest = {
          ...request,
          status: 'approved',
          reviewedBy: getCurrentAdmin()?.name ?? 'Admin',
          reviewedAt: new Date().toISOString(),
        };
        save(updated);
        applyToProfile(updated);
        return updated;
      },
    );
  },

  /**
   * Rejects with one of REJECT_REASONS and an optional note (required for "Other"). The farmer
   * sees "Rejected: <reason>. Please resubmit." and the note, and can submit again.
   */
  async reject(id: string, reason: string, note = ''): Promise<VerificationRequest> {
    await delay();
    const request = find(id);
    const cleanNote = note.trim();
    return withAudit(
      {
        permission: 'verifications.review',
        action: 'verification.reject',
        targetType: 'farmer',
        targetId: request.userId,
        summary: `Rejected the ${KIND_LABELS[request.kind]} check for ${farmerName(request.userId)}: ${reason}`,
        before: { status: request.status },
        after: (r) => ({ status: r.status, reason: r.reason, note: r.note }),
      },
      async () => {
        if (request.status !== 'pending')
          throw new Error('This request has already been reviewed.');
        if (!isRejectReason(reason)) throw new Error('Choose a reason for the farmer.');
        if (reason === 'Other' && cleanNote.length < 3)
          throw new Error('Add a note explaining the reason.');
        if (cleanNote.length > 300) throw new Error('Keep the note under 300 characters.');
        const updated: VerificationRequest = {
          ...request,
          status: 'rejected',
          reviewedBy: getCurrentAdmin()?.name ?? 'Admin',
          reviewedAt: new Date().toISOString(),
          reason,
          ...(cleanNote ? { note: cleanNote } : {}),
        };
        save(updated);
        if (updated.kind === 'ghanaCard') setProfileCard(updated);
        return updated;
      },
    );
  },

  /**
   * Approves several phone or location checks at once (each one audited on its own). Ghana Cards
   * are refused: each card must be reviewed one by one.
   */
  async approveMany(ids: string[]): Promise<VerificationRequest[]> {
    requirePermission('verifications.review');
    const requests = ids.map(find);
    if (requests.some((r) => r.kind === 'ghanaCard'))
      throw new Error('Ghana Cards must be reviewed one by one.');
    if (requests.some((r) => !canBulkApprove(r)))
      throw new Error('Some of these requests have already been reviewed.');
    const approved: VerificationRequest[] = [];
    for (const request of requests) approved.push(await verificationsService.approve(request.id));
    return approved;
  },
};
