import { generateId } from '@/lib/utils';
import { delay, storage, userKey } from '@/services/storage';
import type { FarmRecord, NewRecordInput } from '@/types';

const key = (userId: string) => userKey(userId, 'records');

const read = (userId: string) => storage.get<FarmRecord[]>(key(userId), []);
const write = (userId: string, records: FarmRecord[]) => storage.set(key(userId), records);

/** Newest first, by date and then by creation time. */
const byNewest = (a: FarmRecord, b: FarmRecord) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export const recordsService = {
  async list(userId: string): Promise<FarmRecord[]> {
    await delay();
    return [...read(userId)].sort(byNewest);
  },

  async create(userId: string, input: NewRecordInput): Promise<FarmRecord> {
    await delay();
    const record: FarmRecord = {
      ...input,
      id: generateId(),
      userId,
      createdAt: new Date().toISOString(),
    };
    write(userId, [record, ...read(userId)]);
    return record;
  },

  async update(userId: string, id: string, patch: Partial<NewRecordInput>): Promise<FarmRecord> {
    await delay();
    const records = read(userId);
    const existing = records.find((r) => r.id === id);
    if (!existing) throw new Error('Record not found');
    const updated: FarmRecord = { ...existing, ...patch };
    write(
      userId,
      records.map((r) => (r.id === id ? updated : r)),
    );
    return updated;
  },

  async remove(userId: string, id: string): Promise<void> {
    await delay();
    write(
      userId,
      read(userId).filter((r) => r.id !== id),
    );
  },

  /** Replaces every record for this user (used by sample data and "clear all"). */
  async replaceAll(userId: string, items: FarmRecord[]): Promise<FarmRecord[]> {
    await delay();
    write(userId, items);
    return [...items].sort(byNewest);
  },
};
