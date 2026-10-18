import { delay, storage, userKey } from '@/services/storage';
import type { ChatMessage } from '@/types';

const key = (userId: string) => userKey(userId, 'chat');

export const chatService = {
  async list(userId: string): Promise<ChatMessage[]> {
    await delay();
    return storage.get<ChatMessage[]>(key(userId), []);
  },

  async save(userId: string, messages: ChatMessage[]): Promise<void> {
    await delay();
    storage.set(key(userId), messages);
  },

  async clear(userId: string): Promise<void> {
    await delay();
    storage.remove(key(userId));
  },
};
