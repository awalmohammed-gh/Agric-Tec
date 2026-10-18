'use client';

import { useState } from 'react';
import { ArrowRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_META, REPORT_ORDER } from '@/components/reports/report-meta';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useReportBuilder } from '@/hooks/use-report-data';
import { generateReportPDF } from '@/lib/pdf/generate-report';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/store/report-store';
import type { ReportType } from '@/types';

/** Four report cards: click to preview, or download the PDF straight away. */
export function ReportCardsGrid() {
  const openPreview = useReportStore((s) => s.openPreview);
  const buildReport = useReportBuilder();
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  async function quickDownload(type: ReportType) {
    setDownloading(type);
    try {
      await generateReportPDF(buildReport(type));
      toast.success('Report downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the PDF');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card className="@container">
      <CardHeader>
        <div>
          <CardTitle>Loan-Ready Reports</CardTitle>
          <CardSub>Preview a report, then download it as a PDF to share with lenders</CardSub>
        </div>
      </CardHeader>

      <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
        {REPORT_ORDER.map((type) => {
          const meta = REPORT_META[type];
          const Icon = meta.icon;
          const report = buildReport(type);
          const items = report.table?.rows.length ?? 0;
          return (
            <li
              key={type}
              className={cn(
                'group border-border bg-glass hover:shadow-glass relative flex flex-col rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1',
                meta.hoverBorder,
              )}
            >
              <span
                className={cn(
                  'inline-flex size-12 items-center justify-center rounded-2xl shadow-lg',
                  meta.tone,
                )}
              >
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3 className="text-text mt-4 font-bold">{report.title}</h3>
              <p className="text-text-dim mt-1 flex-1 text-sm">{meta.description}</p>
              <p className="text-text-mute mt-3 text-xs">
                {items}{' '}
                {type === 'tax'
                  ? 'months'
                  : type === 'loan'
                    ? 'credit factors'
                    : `line item${items === 1 ? '' : 's'}`}
              </p>

              <div className="border-border mt-4 flex items-center justify-between gap-2 border-t pt-4">
                {/* Stretched button: clicking anywhere on the card opens the preview. */}
                <button
                  type="button"
                  onClick={() => openPreview(type)}
                  className="text-ink-green inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold after:absolute after:inset-0 after:rounded-2xl after:content-['']"
                >
                  Preview
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => quickDownload(type)}
                  disabled={downloading !== null}
                  aria-label={`Download ${report.title} as PDF`}
                  className="border-border bg-glass text-text-dim hover:bg-glass-strong hover:text-text relative z-10 inline-flex size-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-60"
                >
                  {downloading === type ? (
                    <Loader2 size={16} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Download size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
