import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Crop Diagnoses' };

/** Guarded by content.manage. Built in phase A12. */
export default function DiagnosesContentPage() {
  return (
    <AdminPlaceholder
      permission="content.manage"
      phase="A12"
      features={['Edit the diseases and treatments the crop doctor reports']}
    />
  );
}
