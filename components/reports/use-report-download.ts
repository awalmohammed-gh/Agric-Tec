import { useState } from 'react';
import { toast } from 'sonner';
import { REPORT_ORDER } from '@/components/reports/report-meta';
import { useReportBuilder } from '@/hooks/use-report-data';
import { generateReportPDF } from '@/lib/pdf/generate-report';
import type { ReportType } from '@/types';

export type DownloadTarget = ReportType | 'all';

/** Downloads one report, or all four as a single combined PDF, with a busy state per target. */
export function useReportDownload() {
  const buildReport = useReportBuilder();
  const [busy, setBusy] = useState<DownloadTarget | null>(null);

  async function download(target: DownloadTarget) {
    setBusy(target);
    try {
      const now = new Date();
      await generateReportPDF(
        target === 'all'
          ? REPORT_ORDER.map((type) => buildReport(type, now))
          : buildReport(target, now),
      );
      toast.success(target === 'all' ? 'Complete financial file downloaded' : 'Report downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the PDF');
    } finally {
      setBusy(null);
    }
  }

  return { busy, download };
}
