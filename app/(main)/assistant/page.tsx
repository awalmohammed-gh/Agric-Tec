import type { Metadata } from 'next';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import { AssistantHero } from '@/components/assistant/assistant-hero';
import { CapabilitiesCard } from '@/components/assistant/capabilities-card';
import { FarmContextCard } from '@/components/assistant/farm-context-card';

export const metadata: Metadata = { title: 'AI Assistant' };

export default function AssistantPage() {
  return (
    <div className="@container space-y-6">
      <AssistantHero />
      <div className="grid grid-cols-1 items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_290px]">
        <AssistantChat />
        <aside
          aria-label="Assistant information"
          className="grid gap-5 @2xl:grid-cols-2 @4xl:grid-cols-1"
        >
          <CapabilitiesCard />
          <FarmContextCard />
        </aside>
      </div>
    </div>
  );
}
