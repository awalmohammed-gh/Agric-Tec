import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div role="status" aria-label="Assistant is typing" className="flex items-start gap-2 sm:gap-3">
      <div
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-purple-600 to-blue-600 text-white sm:size-9"
      >
        <Bot size={17} />
      </div>
      <div
        aria-hidden="true"
        className="glass flex h-11 items-center gap-1.5 rounded-2xl rounded-tl-none px-4"
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="bg-text-mute size-2 animate-bounce rounded-full motion-reduce:animate-none"
            style={{ animationDelay: `${dot * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
