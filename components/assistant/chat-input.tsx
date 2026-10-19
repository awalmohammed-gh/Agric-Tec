'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, CornerDownLeft, Sparkles } from 'lucide-react';
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
    <form onSubmit={send}>
      <div className="border-border bg-bg-2/60 focus-within:border-accent/50 focus-within:ring-accent/10 flex items-center gap-2 rounded-2xl border p-2 transition-shadow focus-within:ring-2">
        <Sparkles
          size={17}
          aria-hidden="true"
          className="text-text-mute ml-1 hidden shrink-0 sm:block"
        />
        <Input
          ref={inputRef}
          aria-label="Message the assistant"
          aria-describedby={text.length > 400 ? 'chat-character-count' : undefined}
          placeholder="Ask about your farm…"
          value={text}
          maxLength={500}
          disabled={disabled}
          className="min-w-0 border-0 bg-transparent px-2 focus:shadow-none"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.shiftKey || event.nativeEvent.isComposing)) {
              event.preventDefault();
            }
          }}
        />
        <Button
          type="submit"
          icon={ArrowUp}
          aria-label="Send message"
          disabled={disabled || !text.trim()}
          className="size-10 min-h-10 shrink-0 rounded-xl px-0"
        >
          <span className="sr-only">Send</span>
        </Button>
      </div>
      <div className="text-text-mute mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px]">
        <p>Guidance for your farm. Confirm local conditions.</p>
        {text.length > 400 ? (
          <p id="chat-character-count" className="tabular-nums">
            {text.length}/500 characters
          </p>
        ) : (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <CornerDownLeft size={11} aria-hidden="true" />
            Enter to send
          </span>
        )}
      </div>
    </form>
  );
}
