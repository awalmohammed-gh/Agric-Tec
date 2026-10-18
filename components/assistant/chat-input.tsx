'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/store/chat-store';

export function ChatInput() {
  const [text, setText] = useState('');
  const isTyping = useChatStore((state) => state.isTyping);
  const status = useChatStore((state) => state.status);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const disabled = isTyping || status !== 'ready';

  useEffect(() => {
    if (!disabled && restoreFocus.current) {
      inputRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [disabled]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !text.trim()) return;
    restoreFocus.current = true;
    void sendMessage(text);
    setText('');
  }

  return (
    <form onSubmit={send} className="mt-4">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          aria-label="Message the assistant"
          aria-describedby={text.length > 400 ? 'chat-character-count' : undefined}
          placeholder="Ask about your farm…"
          value={text}
          maxLength={500}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.shiftKey || event.nativeEvent.isComposing)) {
              event.preventDefault();
            }
          }}
        />
        <Button
          type="submit"
          icon={Send}
          aria-label="Send message"
          disabled={disabled || !text.trim()}
          className="shrink-0 px-3 sm:px-5"
        >
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      {text.length > 400 && (
        <p
          id="chat-character-count"
          className="text-text-mute mt-1.5 text-right text-xs tabular-nums"
        >
          {text.length}/500 characters
        </p>
      )}
    </form>
  );
}
