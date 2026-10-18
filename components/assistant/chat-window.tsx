'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from '@/components/assistant/message-bubble';
import { TypingIndicator } from '@/components/assistant/typing-indicator';
import { useChatStore } from '@/store/chat-store';

export function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const isTyping = useChatStore((state) => state.isTyping);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }, [messages, isTyping]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label="Conversation with AgriCtec assistant"
      aria-live="polite"
      aria-relevant="additions text"
      tabIndex={0}
      className="border-border bg-bg-2/40 h-[60vh] space-y-5 overflow-y-auto overscroll-contain rounded-2xl border p-3 sm:h-[420px] sm:p-4"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  );
}
