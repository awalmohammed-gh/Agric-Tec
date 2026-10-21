import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'AI Assistant' };

/** Guarded by content.manage. Built in phase A12. */
export default function AssistantContentPage() {
  return (
    <AdminPlaceholder
      permission="content.manage"
      phase="A12"
      features={[
        'Edit the assistant’s replies, keywords and priorities',
        'Placeholders such as {name} and {score}',
      ]}
    />
  );
}
