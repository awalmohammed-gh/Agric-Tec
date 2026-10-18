import type { Metadata } from 'next';
import { Bot } from 'lucide-react';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import { CapabilitiesCard } from '@/components/assistant/capabilities-card';
import { AiBanner } from '@/components/ui/ai-banner';

export const metadata: Metadata = { title: 'AI Assistant' };

export default function AssistantPage() {
  return (
    <div className="@container space-y-6">
      <AiBanner
        icon={Bot}
        title="AgriCtec AI Agronomist"
        subtitle="Practical advice for your crops, your finances and your next growing season."
      />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AssistantChat />
        <CapabilitiesCard />
      </div>
    </div>
  );
}
