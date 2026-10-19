import { create } from 'zustand';
import { getAssistantReply, type AssistantContext } from '@/lib/ai/assistant-replies';
import { calculateCreditScore } from '@/lib/calculations/credit-score';
import { totalExpenses, totalIncome } from '@/lib/calculations/finance';
import { generateId } from '@/lib/utils';
import { chatService } from '@/services/chat.service';
import { useFarmStore } from '@/store/farm-store';
import { useProfileStore } from '@/store/profile-store';
import type { ChatMessage, StoreStatus } from '@/types';

let loadVersion = 0;

function welcomeMessage(): ChatMessage {
  return {
    id: generateId(),
    role: 'ai',
    content:
      'Akwaaba! I’m your AgriCtec AI assistant. I can help with crop advice, pest control, weather, market prices and your farm finances. Ask me a question or choose a quick prompt below!',
    createdAt: new Date().toISOString(),
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
    const version = ++loadVersion;
    set({ userId, messages: [], isTyping: false, status: 'loading' });
    try {
      const history = await chatService.list(userId);
      if (get().userId !== userId || version !== loadVersion) return;
      const messages = history.length ? history : [welcomeMessage()];
      if (!history.length) await chatService.save(userId, messages);
      if (get().userId !== userId || version !== loadVersion) return;
      set({ messages, status: 'ready' });
    } catch (error) {
      if (get().userId !== userId || version !== loadVersion) return;
      set({ status: 'error' });
      throw error;
    }
  },

  sendMessage: async (text) => {
    const { userId, isTyping, status } = get();
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;
    if (!userId) throw new Error('You need to sign in first');
    if (isTyping || status !== 'ready') return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, userMessage], isTyping: true }));
    // An in-flight reply must never appear in another session or a reloaded history.
    const isCurrent = () => get().userId === userId && get().messages.includes(userMessage);
    const appendError = () =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: generateId(),
            role: 'ai',
            content: { title: 'Sorry, something went wrong. Please try again.' },
            createdAt: new Date().toISOString(),
          },
        ],
      }));

    try {
      const farm = useFarmStore.getState();
      const profileState = useProfileStore.getState();
      const profile = profileState.userId === userId ? profileState.profile : null;
      const records = farm.userId === userId ? farm.records : [];
      const momo = farm.userId === userId ? farm.momo : [];
      const credit = calculateCreditScore(records, momo, profile);
      const context: AssistantContext = {
        farmerName: profile?.name || 'Farmer',
        region: profile?.region || '',
        primaryCrops: profile?.primaryCrops ?? [],
        score: credit.score,
        income: totalIncome(records),
        expenses: totalExpenses(records),
        recordCount: records.length,
        creditFactors: credit,
      };
      const reply = await getAssistantReply(trimmed, context);
      if (!isCurrent()) return;
      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'ai',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, aiMessage] }));
      await chatService.save(userId, get().messages);
    } catch {
      if (!isCurrent()) return;
      appendError();
      try {
        await chatService.save(userId, get().messages);
      } catch {
        // Keep the error visible even if persistence is unavailable.
      }
    } finally {
      if (isCurrent()) set({ isTyping: false });
    }
  },

  clear: async () => {
    const { userId, isTyping, status } = get();
    if (!userId) throw new Error('You need to sign in first');
    if (isTyping || status !== 'ready') return;
    const version = loadVersion;
    set({ status: 'loading' });
    try {
      const messages = [welcomeMessage()];
      // Replace the persisted history atomically with just the welcome message.
      await chatService.save(userId, messages);
      if (get().userId !== userId || version !== loadVersion) return;
      set({ messages, status: 'ready' });
    } finally {
      if (get().userId === userId && version === loadVersion) set({ status: 'ready' });
    }
  },
}));
