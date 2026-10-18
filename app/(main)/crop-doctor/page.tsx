import type { Metadata } from 'next';
import { ScanLine } from 'lucide-react';
import { CropDoctorView } from '@/components/crop-doctor/crop-doctor-view';
import { AiBanner } from '@/components/ui/ai-banner';

export const metadata: Metadata = { title: 'AI Crop Doctor' };

export default function CropDoctorPage() {
  return (
    <div className="@container space-y-6">
      <AiBanner
        icon={ScanLine}
        title="AgriCtec AI Crop Doctor"
        subtitle="Explore a sample crop diagnosis and treatment guide. Results are simulated; confirm crop problems with your extension officer."
        className="rounded-3xl"
      />
      <CropDoctorView />
    </div>
  );
}
