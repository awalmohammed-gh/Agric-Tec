import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  canDelete,
  canEdit,
  canEnd,
  inAudience,
  needsCriticalConfirm,
} from '@/lib/admin/announcements';
import { announcementInputSchema, parseOrThrow } from '@/lib/admin/schemas';
import { generateId } from '@/lib/utils';
import { delay, storage } from '@/services/storage';
import type { Profile } from '@/types';
import type { Announcement } from '@/types/admin';

export type AnnouncementInput = Omit<Announcement, 'id' | 'createdBy' | 'createdAt'>;

const read = () => storage.get<Announcement[]>(PLATFORM_KEYS.announcements, []);
const write = (items: Announcement[]) => storage.set(PLATFORM_KEYS.announcements, items);

function find(id: string): Announcement {
  const item = read().find((a) => a.id === id);
  if (!item) throw new Error('Announcement not found.');
  return item;
}

/** Switched on and inside its time window. */
export function isLive(a: Announcement, now = new Date()): boolean {
  const t = now.toISOString();
  return a.active && a.startsAt <= t && (!a.endsAt || a.endsAt > t);
}

/** Whether the farmer is in the announcement's audience. */
export function reaches(
  a: Announcement,
  profile: Pick<Profile, 'region' | 'primaryCrops'>,
): boolean {
  return inAudience(a.audience, profile);
}

const SEVERITY: Record<Announcement['type'], number> = {
  critical: 0,
  warning: 1,
  success: 2,
  info: 3,
};

/** Critical first, then warning, success, info; newest first within each. */
export const bySeverity = (a: Announcement, b: Announcement) =>
  SEVERITY[a.type] - SEVERITY[b.type] || b.startsAt.localeCompare(a.startsAt);

const inputOf = (a: Announcement): AnnouncementInput => ({
  title: a.title,
  message: a.message,
  type: a.type,
  audience: a.audience,
  startsAt: a.startsAt,
  ...(a.endsAt && { endsAt: a.endsAt }),
  active: a.active,
  dismissible: a.dismissible,
});

export const announcementsService = {
  /** Newest first. */
  async list(): Promise<Announcement[]> {
    await delay();
    requirePermission('announcements.send');
    return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Critical announcements to everyone need confirmedCritical (the form asks the admin first).
   */
  async create(
    input: AnnouncementInput,
    { confirmedCritical = false }: { confirmedCritical?: boolean } = {},
  ): Promise<Announcement> {
    await delay();
    return withAudit(
      {
        permission: 'announcements.send',
        action: 'announcement.create',
        targetType: 'announcement',
        targetId: (a) => a.id,
        summary: `Created announcement “${input.title.trim()}”`,
      },
      async () => {
        const valid = parseOrThrow(announcementInputSchema, input);
        if (needsCriticalConfirm(valid) && !confirmedCritical)
          throw new Error('Confirm sending a critical announcement to every farmer.');
        const announcement: Announcement = {
          ...valid,
          id: generateId(),
          createdBy: getCurrentAdmin()?.name ?? 'Admin',
          createdAt: new Date().toISOString(),
        };
        write([announcement, ...read()]);
        return announcement;
      },
    );
  },

  /** Only before it starts (afterwards: end it and duplicate). Same critical rule as create. */
  async update(
    id: string,
    patch: Partial<AnnouncementInput>,
    { confirmedCritical = false }: { confirmedCritical?: boolean } = {},
  ): Promise<Announcement> {
    await delay();
    const current = find(id);
    return withAudit(
      {
        permission: 'announcements.send',
        action: 'announcement.update',
        targetType: 'announcement',
        targetId: id,
        summary: `Edited announcement “${current.title}”`,
        before: inputOf(current),
        after: (a) => inputOf(a),
      },
      async () => {
        if (!canEdit(current))
          throw new Error(
            'Only scheduled announcements can be edited. End it and duplicate it instead.',
          );
        const valid = parseOrThrow(announcementInputSchema, { ...inputOf(current), ...patch });
        if (needsCriticalConfirm(valid) && !needsCriticalConfirm(current) && !confirmedCritical)
          throw new Error('Confirm sending a critical announcement to every farmer.');
        const updated: Announcement = { ...current, ...valid };
        write(read().map((a) => (a.id === id ? updated : a)));
        return updated;
      },
    );
  },

  /** Takes it down now, keeping it in the list. */
  async end(id: string): Promise<Announcement> {
    await delay();
    const current = find(id);
    return withAudit(
      {
        permission: 'announcements.send',
        action: 'announcement.end',
        targetType: 'announcement',
        targetId: id,
        summary: `Ended announcement “${current.title}”`,
        before: { active: current.active, endsAt: current.endsAt },
        after: (a) => ({ active: a.active, endsAt: a.endsAt }),
      },
      async () => {
        if (!canEnd(current)) throw new Error('This announcement has already ended.');
        const now = new Date().toISOString();
        const updated: Announcement = {
          ...current,
          active: false,
          endsAt: current.endsAt && current.endsAt < now ? current.endsAt : now,
        };
        write(read().map((a) => (a.id === id ? updated : a)));
        return updated;
      },
    );
  },

  async remove(id: string): Promise<void> {
    await delay();
    const current = find(id);
    return withAudit(
      {
        permission: 'announcements.send',
        action: 'announcement.delete',
        targetType: 'announcement',
        targetId: id,
        summary: `Deleted announcement “${current.title}”`,
        before: current,
        after: () => ({ deleted: true }),
      },
      async () => {
        if (!canDelete(current))
          throw new Error('Farmers are seeing this announcement now. End it before deleting.');
        write(read().filter((a) => a.id !== id));
      },
    );
  },

  /**
   * Every live announcement, most severe first, for any audience. The farmer app filters these
   * with reaches() against the current profile, so a region change applies at once.
   */
  async listLive(): Promise<Announcement[]> {
    await delay();
    const now = new Date();
    return read()
      .filter((a) => isLive(a, now))
      .sort(bySeverity);
  },

  /** Live announcements for one farmer, most severe first. */
  async activeFor(profile: Pick<Profile, 'region' | 'primaryCrops'>): Promise<Announcement[]> {
    return (await announcementsService.listLive()).filter((a) => reaches(a, profile));
  },
};
