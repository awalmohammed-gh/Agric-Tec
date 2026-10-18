import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import { chatService } from '@/services/chat.service';
import { delay } from '@/services/storage';
import type { AssistantReply, ChatMessage, StoreStatus } from '@/types';

const TYPING_DELAY_MS = 700;

/** Temporary reply until the real assistant (lib/ai/assistant-replies.ts) is connected. */
async function stubReply(text: string): Promise<AssistantReply> {
  await delay(TYPING_DELAY_MS);
  return {
    title: 'AgriCtec Assistant',
    intro: `You asked: "${text}"`,
    bullets: ['Detailed farming and finance advice is coming soon.'],
    tip: 'Keep recording your farm activity to build your financial identity.',
  };
}

interface ChatState {
  userId: string | null;
  messages: ChatMessage[];
  isTyping: boolean;
  status: StoreStatus;
  load: (userId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  userId: null,
  messages: [],
  isTyping: false,
  status: 'idle',

  load: async (userId) => {
    set({ userId, status: 'loading' });
    try {
      const messages = await chatService.list(userId);
      if (get().userId !== userId) return;
      set({ messages, status: 'ready' });
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },

  sendMessage: async (text) => {
    const { userId } = get();
    const trimmed = text.trim();
    if (!userId) throw new Error('You need to sign in first');
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, userMessage], isTyping: true }));

    try {
      const reply = await stubReply(trimmed);
      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'ai',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, aiMessage] }));
      await chatService.save(userId, get().messages);
    } finally {
      set({ isTyping: false });
    }
  },

  clear: async () => {
    const { userId } = get();
    if (!userId) throw new Error('You need to sign in first');
    await chatService.clear(userId);
    set({ messages: [] });
  },
}));
