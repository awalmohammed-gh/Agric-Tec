// The audit trail (admin spec Section 8). Append-only: nothing here, or anywhere else, edits or
// deletes an entry, including for a super admin.

import { requirePermission } from '@/lib/admin/admin-session';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { generateId } from '@/lib/utils';
import { storage } from '@/services/storage';
import type { AdminUser, AuditEntry, Permission } from '@/types/admin';

/** Above this, the oldest entries move to the archive (downloadable from the audit log). */
export const MAX_AUDIT_ENTRIES = 5000;

export interface AuditMeta<T> {
  /** Checked before `fn` runs. Without it, nothing runs and nothing is logged. */
  permission: Permission;
  /** e.g. 'farmer.suspend', 'credit.update' */
  action: string;
  targetType: AuditEntry['targetType'];
  /** A function when the ID is only known from the result (e.g. a newly created item). */
  targetId?: string | ((result: T) => string | undefined);
  summary: string | ((result: T) => string);
  before?: unknown;
  /**
   * What to store as `after`. Defaults to the result itself; pass a mapper to keep large or
   * sensitive results (a CSV export, a temporary password) out of the log.
   */
  after?: (result: T) => unknown;
}

export type NewAuditEntry = Omit<
  AuditEntry,
  'id' | 'actorId' | 'actorName' | 'actorRole' | 'createdAt'
>;

/** Oldest first, as appended. */
export const readAuditLog = (): AuditEntry[] => storage.get<AuditEntry[]>(PLATFORM_KEYS.audit, []);
export const readAuditArchive = (): AuditEntry[] =>
  storage.get<AuditEntry[]>(PLATFORM_KEYS.auditArchive, []);

/** Drops `undefined` and copies the value, so later changes to it never alter a logged entry. */
const snapshot = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/**
 * Appends one entry. Only for events that are not permission-gated writes (sign-in, sign-out,
 * password change); every admin write goes through withAudit instead.
 */
export function appendAudit(actor: AdminUser, entry: NewAuditEntry): AuditEntry {
  const full: AuditEntry = {
    id: generateId(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    ...entry,
    before: snapshot(entry.before),
    after: snapshot(entry.after),
    createdAt: new Date().toISOString(),
  };
  const log = [...readAuditLog(), full];
  const overflow = log.length - MAX_AUDIT_ENTRIES;
  if (overflow > 0) {
    // Archive rather than drop: the oldest entries stay downloadable as JSON.
    storage.set(PLATFORM_KEYS.auditArchive, [...readAuditArchive(), ...log.slice(0, overflow)]);
    storage.set(PLATFORM_KEYS.audit, log.slice(overflow));
  } else {
    storage.set(PLATFORM_KEYS.audit, log);
  }
  return full;
}

/**
 * Runs an admin write and records it:
 * 1. checks the current admin's permission (throws PermissionError: nothing runs, nothing is logged)
 * 2. runs fn() (if it throws, nothing is logged)
 * 3. appends an AuditEntry with `after` = the result (or `meta.after(result)`)
 * 4. returns the result
 * The admin is read from the session, so callers never pass it in.
 */
export async function withAudit<T>(meta: AuditMeta<T>, fn: () => Promise<T>): Promise<T> {
  const actor = requirePermission(meta.permission);
  const result = await fn();
  appendAudit(actor, {
    action: meta.action,
    targetType: meta.targetType,
    targetId: typeof meta.targetId === 'function' ? meta.targetId(result) : meta.targetId,
    summary: typeof meta.summary === 'function' ? meta.summary(result) : meta.summary,
    before: meta.before,
    after: meta.after ? meta.after(result) : result,
  });
  return result;
}
