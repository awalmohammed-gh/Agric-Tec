'use client';

import { useState } from 'react';
import { Bot, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ChatInput } from '@/components/assistant/chat-input';
import { ChatWindow } from '@/components/assistant/chat-window';
import { QuickPrompts } from '@/components/assistant/quick-prompts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useChatStore } from '@/store/chat-store';

export function AssistantChat() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const isTyping = useChatStore((state) => state.isTyping);
  const status = useChatStore((state) => state.status);
  const clear = useChatStore((state) => state.clear);

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
    <Card className="min-w-0">
      <CardHeader className="items-center">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bot size={18} aria-hidden="true" className="text-purple" />
            Chat with AI
          </CardTitle>
          <CardSub>Plain-language advice for your farm</CardSub>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          disabled={isTyping || status !== 'ready' || isClearing}
          onClick={() => setConfirmOpen(true)}
        >
          Clear chat
        </Button>
      </CardHeader>
      <ChatWindow />
      <ChatInput />
      <QuickPrompts />
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
