'use client';

import { useChatStore } from '@/store/chat-store';

const prompts = [
  '🌽 Maize planting',
  '🐛 Pest control',
  '💳 Credit tips',
  '💰 Cocoa prices',
  '📊 My finances',
  '🌦️ Weather',
];

export function QuickPrompts() {
  const isTyping = useChatStore((state) => state.isTyping);
  const status = useChatStore((state) => state.status);
  const sendMessage = useChatStore((state) => state.sendMessage);

  return (
    <div role="group" aria-label="Quick prompts" className="mt-4 flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={isTyping || status !== 'ready'}
          onClick={() => void sendMessage(prompt)}
          className="glass text-text-dim hover:bg-glass-strong hover:text-text min-h-9 rounded-full px-3 py-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
