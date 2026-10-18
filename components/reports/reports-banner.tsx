'use client';

import { FileCheck2, FileDown, Lock, RefreshCw } from 'lucide-react';
import { AiBanner } from '@/components/ui/ai-banner';
import { Button } from '@/components/ui/button';
import { useReportStore } from '@/store/report-store';

const FEATURES = [
  { icon: FileDown, label: 'Real PDF downloads' },
  { icon: RefreshCw, label: 'Always up to date' },
  { icon: Lock, label: 'Stays on your device' },
];

export function ReportsBanner() {
  const openPreview = useReportStore((s) => s.openPreview);

  return (
    <AiBanner
      icon={FileCheck2}
      title="AI-Generated Loan-Ready Reports"
      subtitle={
        <>
          Share verified financial records with banks and microfinance institutions.
          <span className="mt-3 flex flex-wrap gap-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="border-border bg-glass text-text-dim inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              >
                <Icon size={12} aria-hidden="true" /> {label}
              </span>
            ))}
          </span>
        </>
      }
      action={
        <Button icon={FileCheck2} onClick={() => openPreview('loan')}>
          Generate Loan Report
        </Button>
      }
    />
  );
}
