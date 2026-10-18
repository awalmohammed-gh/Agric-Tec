import { Bot, UserRound } from 'lucide-react';
import { MessageContent } from '@/components/assistant/message-content';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const timeFormat = new Intl.DateTimeFormat('en-GH', { hour: '2-digit', minute: '2-digit' });

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const Icon = isUser ? UserRound : Bot;

  return (
    <div className={cn('flex items-start gap-2 sm:gap-3', isUser && 'flex-row-reverse')}>
      <div
        aria-hidden="true"
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-white sm:size-9',
          isUser ? 'bg-emerald-700' : 'bg-linear-to-br from-purple-600 to-blue-600',
        )}
      >
        <Icon size={17} />
      </div>
      <div className="max-w-[85%] min-w-0 flex-1 sm:flex-none">
        <span className="sr-only">{isUser ? 'You' : 'AgriCtec assistant'}</span>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]',
            isUser
              ? 'rounded-tr-none bg-linear-to-br from-emerald-700 to-emerald-800 text-white'
              : 'glass text-text rounded-tl-none',
          )}
        >
          <MessageContent content={message.content} />
        </div>
        <time
          dateTime={message.createdAt}
          title={new Date(message.createdAt).toLocaleString('en-GH')}
          className={cn('text-text-mute mt-1.5 block px-1 text-[10px]', isUser && 'text-right')}
        >
          {timeFormat.format(new Date(message.createdAt))}
        </time>
      </div>
    </div>
  );
}
