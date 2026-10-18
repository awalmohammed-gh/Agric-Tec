import type { AssistantReply } from '@/types';

export function MessageContent({ content }: { content: string | AssistantReply }) {
  if (typeof content === 'string') {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="font-bold">{content.title}</p>
      {content.intro && <p className="whitespace-pre-wrap">{content.intro}</p>}
      {content.bullets && content.bullets.length > 0 && (
        <ul className="list-disc space-y-2 pl-5">
          {content.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
      {content.tip && (
        <div className="border-accent/25 bg-accent/10 flex gap-2 rounded-xl border p-3">
          <span aria-hidden="true">💡</span>
          <p>
            <span className="font-semibold">Tip: </span>
            {content.tip}
          </p>
        </div>
      )}
    </div>
  );
}
