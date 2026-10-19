'use client';

import { useState } from 'react';
import { Bot, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ChatInput } from '@/components/assistant/chat-input';
import { ChatWindow } from '@/components/assistant/chat-window';
import { QuickPrompts } from '@/components/assistant/quick-prompts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useChatStore } from '@/store/chat-store';

export function AssistantChat() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const isTyping = useChatStore((state) => state.isTyping);
  const status = useChatStore((state) => state.status);
  const clear = useChatStore((state) => state.clear);
  const hasConversation = useChatStore((state) => state.messages.length > 1);

  async function clearChat() {
    setIsClearing(true);
    try {
      await clear();
      setConfirmOpen(false);
    } catch {
      toast.error('Could not clear your chat. Please try again.');
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card padding="none" className="min-w-0 rounded-3xl">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="border-accent/20 bg-accent/10 text-ink-green flex size-10 shrink-0 items-center justify-center rounded-2xl border">
            <Bot size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-text text-sm font-bold">Chat with AI</h3>
            <p className="text-text-mute mt-1 flex items-center gap-1.5 text-[11px]">
              <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
              {isTyping ? 'Preparing your answer' : 'Your farming companion'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          disabled={isTyping || status !== 'ready' || isClearing || !hasConversation}
          onClick={() => setConfirmOpen(true)}
          className="text-text-mute shrink-0 border-0 bg-transparent shadow-none backdrop-blur-none"
        >
          Clear chat
        </Button>
      </div>
      <ChatWindow />
      <div className="border-border bg-glass border-t px-4 pt-4 pb-3 sm:px-6">
        {hasConversation && <QuickPrompts />}
        <ChatInput />
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Clear chat?"
        message="This removes your conversation history. The welcome message will remain so you can start again."
        confirmLabel="Clear chat"
        danger
        loading={isClearing}
        onConfirm={() => void clearChat()}
        onCancel={() => {
          if (!isClearing) setConfirmOpen(false);
        }}
      />
    </Card>
  );
}
