// Read-only access to the audit trail. There is deliberately no update or delete function:
// the log is append-only for everyone, including a super admin.

import { requirePermission } from '@/lib/admin/admin-session';
import { readAuditArchive, readAuditLog, withAudit } from '@/lib/admin/audit';
import { auditGroupOf } from '@/lib/admin/audit-groups';
import { toCSV } from '@/lib/export/csv';
import { delay } from '@/services/storage';
import type { AuditEntry, AuditFilter, Paged } from '@/types/admin';

export const AUDIT_PAGE_SIZE = 50;

function matches(entry: AuditEntry, filter: AuditFilter): boolean {
  const search = filter.search?.trim().toLowerCase();
  return (
    (!filter.actorId || entry.actorId === filter.actorId) &&
    (!filter.action ||
      (filter.action.endsWith('.')
        ? entry.action.startsWith(filter.action)
        : entry.action === filter.action)) &&
    (!filter.group || auditGroupOf(entry.action) === filter.group) &&
    (!filter.targetType || entry.targetType === filter.targetType) &&
    (!filter.targetId || entry.targetId === filter.targetId) &&
    // Dates compare as text; a bare "yyyy-MM-dd" upper bound includes that whole day.
    (!filter.from || entry.createdAt >= filter.from) &&
    (!filter.to ||
      entry.createdAt <= (filter.to.length === 10 ? `${filter.to}T23:59:59.999Z` : filter.to)) &&
    (!search ||
      [entry.summary, entry.actorName, entry.targetId ?? '', entry.action].some((text) =>
        text.toLowerCase().includes(search),
      ))
  );
}

export const auditService = {
  /** Newest first, one page at a time. */
  async list(
    filter: AuditFilter = {},
    page = 1,
    pageSize = AUDIT_PAGE_SIZE,
  ): Promise<Paged<AuditEntry>> {
    await delay();
    requirePermission('audit.view');
    const items = readAuditLog()
      .filter((entry) => matches(entry, filter))
      .reverse();
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(Math.max(1, page), pageCount);
    return {
      items: items.slice((current - 1) * pageSize, current * pageSize),
      total: items.length,
      page: current,
      pageSize,
      pageCount,
    };
  },

  /** How many entries have been moved out of the live log into the archive. */
  async archiveInfo(): Promise<{ count: number; oldest?: string; newest?: string }> {
    await delay();
    requirePermission('audit.view');
    const archive = readAuditArchive();
    return {
      count: archive.length,
      oldest: archive[0]?.createdAt,
      newest: archive.at(-1)?.createdAt,
    };
  },

  /**
   * Every entry matching the filter (archived ones included), oldest first, as JSON or CSV.
   * The export is itself written to the log.
   */
  async exportFiltered(
    filter: AuditFilter,
    format: 'json' | 'csv',
  ): Promise<{ filename: string; content: string }> {
    await delay();
    const entries = [...readAuditArchive(), ...readAuditLog()].filter((e) => matches(e, filter));
    const stamp = new Date().toISOString().slice(0, 10);
    return withAudit(
      {
        permission: 'audit.view',
        action: 'audit.export',
        targetType: 'system',
        summary: `Exported ${entries.length} audit entr${entries.length === 1 ? 'y' : 'ies'} (${format.toUpperCase()})`,
        after: () => ({ count: entries.length, format, ...filter }),
      },
      async () => ({
        filename: `AgriCtec_Audit_Log_${stamp}.${format}`,
        content:
          format === 'json'
            ? JSON.stringify(
                {
                  app: 'agrictec',
                  kind: 'audit-log',
                  exportedAt: new Date().toISOString(),
                  filter,
                  entries,
                },
                null,
                2,
              )
            : toCSV(entries, [
                { header: 'Time', value: (e) => e.createdAt },
                { header: 'Actor', value: (e) => e.actorName },
                { header: 'Role', value: (e) => e.actorRole },
                { header: 'Action', value: (e) => e.action },
                { header: 'Target type', value: (e) => e.targetType },
                { header: 'Target', value: (e) => e.targetId ?? '' },
                { header: 'Summary', value: (e) => e.summary },
                {
                  header: 'Before',
                  value: (e) => (e.before === undefined ? '' : JSON.stringify(e.before)),
                },
                {
                  header: 'After',
                  value: (e) => (e.after === undefined ? '' : JSON.stringify(e.after)),
                },
              ]),
      }),
    );
  },

  /** The people who appear in the log (for the actor filter), newest activity first. */
  async actors(): Promise<{ id: string; name: string; role: AuditEntry['actorRole'] }[]> {
    await delay(0);
    requirePermission('audit.view');
    const seen = new Map<string, { id: string; name: string; role: AuditEntry['actorRole'] }>();
    for (const e of [...readAuditLog()].reverse())
      if (!seen.has(e.actorId))
        seen.set(e.actorId, { id: e.actorId, name: e.actorName, role: e.actorRole });
    return [...seen.values()];
  },

  /** JSON of every entry in the range, archived ones included, oldest first. The export is logged. */
  async exportJSON(range: Pick<AuditFilter, 'from' | 'to'> = {}): Promise<string> {
    await delay();
    const entries = [...readAuditArchive(), ...readAuditLog()].filter((e) => matches(e, range));
    return withAudit(
      {
        permission: 'audit.view',
        action: 'audit.export',
        targetType: 'system',
        summary: `Exported ${entries.length} audit entr${entries.length === 1 ? 'y' : 'ies'}`,
        after: () => ({ count: entries.length, ...range }),
      },
      async () =>
        JSON.stringify(
          {
            app: 'agrictec',
            kind: 'audit-log',
            exportedAt: new Date().toISOString(),
            range,
            entries,
          },
          null,
          2,
        ),
    );
  },
};
