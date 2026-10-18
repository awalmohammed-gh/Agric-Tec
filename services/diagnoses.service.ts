import { generateId } from '@/lib/utils';
import { delay, storage, userKey } from '@/services/storage';
import type { Diagnosis, NewDiagnosisInput } from '@/types';

const MAX_HISTORY = 10;

const key = (userId: string) => userKey(userId, 'diagnoses');

const read = (userId: string) => storage.get<Diagnosis[]>(key(userId), []);
const write = (userId: string, items: Diagnosis[]) => storage.set(key(userId), items);

export const diagnosesService = {
  async list(userId: string): Promise<Diagnosis[]> {
    await delay();
    return read(userId);
  },

  /** Puts the new diagnosis first and keeps only the 10 most recent. */
  async create(userId: string, input: NewDiagnosisInput): Promise<Diagnosis> {
    await delay();
    const diagnosis: Diagnosis = { ...input, id: generateId(), userId };
    write(userId, [diagnosis, ...read(userId)].slice(0, MAX_HISTORY));
    return diagnosis;
  },

  async remove(userId: string, id: string): Promise<void> {
    await delay();
    write(
      userId,
      read(userId).filter((d) => d.id !== id),
    );
  },

  async clear(userId: string): Promise<void> {
    await delay();
    write(userId, []);
  },
};
