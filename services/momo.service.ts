import { generateId } from '@/lib/utils';
import { delay, storage, userKey } from '@/services/storage';
import type { MomoTransaction, NewMomoInput } from '@/types';

const key = (userId: string) => userKey(userId, 'momo');

const read = (userId: string) => storage.get<MomoTransaction[]>(key(userId), []);
const write = (userId: string, items: MomoTransaction[]) => storage.set(key(userId), items);

/** Newest first, by date and then by creation time. */
const byNewest = (a: MomoTransaction, b: MomoTransaction) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export const momoService = {
  async list(userId: string): Promise<MomoTransaction[]> {
    await delay();
    return [...read(userId)].sort(byNewest);
  },

  async create(userId: string, input: NewMomoInput): Promise<MomoTransaction> {
    await delay();
    const transaction: MomoTransaction = {
      ...input,
      id: generateId(),
      userId,
      createdAt: new Date().toISOString(),
    };
    write(userId, [transaction, ...read(userId)]);
    return transaction;
  },

  async update(userId: string, id: string, patch: Partial<NewMomoInput>): Promise<MomoTransaction> {
    await delay();
    const items = read(userId);
    const existing = items.find((t) => t.id === id);
    if (!existing) throw new Error('Transaction not found');
    const updated: MomoTransaction = { ...existing, ...patch };
    write(
      userId,
      items.map((t) => (t.id === id ? updated : t)),
    );
    return updated;
  },

  async remove(userId: string, id: string): Promise<void> {
    await delay();
    write(
      userId,
      read(userId).filter((t) => t.id !== id),
    );
  },

  /** Replaces every transaction for this user (used by sample data and "clear all"). */
  async replaceAll(userId: string, items: MomoTransaction[]): Promise<MomoTransaction[]> {
    await delay();
    write(userId, items);
    return [...items].sort(byNewest);
  },
};
