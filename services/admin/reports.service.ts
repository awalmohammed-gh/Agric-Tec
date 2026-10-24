// Reports & analytics (phase A14). Every download (a ready-made report as CSV or PDF, or a custom
// report from the builder) is checked against reports.export and written to the audit log as
// "report.export". Only counts and the chosen columns leave the console: no secrets.

import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import {
  buildAdminReport,
  reportFileName,
  reportToCSV,
  type AdminReport,
  type ReportId,
  type ReportInput,
} from '@/lib/admin/admin-reports';
import { withAudit } from '@/lib/admin/audit';
import { DEFAULT_CREDIT_CONFIG, DEFAULT_LENDERS } from '@/lib/admin/defaults';
import { buildFarmerAccount, readFarmerData, readUsers } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  builderToCSV,
  datasetById,
  runBuilder,
  type BuilderResult,
  type BuilderSource,
  type BuilderSpec,
} from '@/lib/admin/report-builder';
import { generateAdminReportPDF } from '@/lib/pdf/generate-admin-report';
import { delay, storage } from '@/services/storage';
import type {
  CreditConfig,
  Lender,
  LoanApplication,
  RiskFlag,
  VerificationRequest,
} from '@/types/admin';

export type ReportFormat = 'csv' | 'pdf';

export interface ReportData extends ReportInput, BuilderSource {}

/** Everything the reports and the builder read, straight from storage. */
function readAll(): ReportData {
  const users = readUsers();
  const farmers = users.map((user) => buildFarmerAccount(user));
  const data = users.map((user) => readFarmerData(user.id));
  return {
    farmers,
    records: data.flatMap((d) => d.records),
    momo: data.flatMap((d) => d.momo),
    applications: storage.get<LoanApplication[]>(PLATFORM_KEYS.loanApplications, []),
    lenders: storage.get<Lender[]>(PLATFORM_KEYS.lenders, DEFAULT_LENDERS),
    verifications: storage.get<VerificationRequest[]>(PLATFORM_KEYS.verifications, []),
    riskFlags: storage.get<RiskFlag[]>(PLATFORM_KEYS.riskFlags, []),
    bands: storage.get<CreditConfig>(PLATFORM_KEYS.creditConfig, DEFAULT_CREDIT_CONFIG).bands,
  };
}

export const reportsService = {
  /** The data behind every report and the builder (reports.export). */
  async load(): Promise<ReportData> {
    await delay();
    requirePermission('reports.export');
    return readAll();
  },

  /** One ready-made report, built from the latest data (for the preview). */
  async build(id: ReportId): Promise<AdminReport> {
    await delay();
    requirePermission('reports.export');
    return buildAdminReport(id, readAll());
  },

  /** Downloads a ready-made report as CSV or PDF. Audited ("report.export"). */
  async exportReport(
    id: ReportId,
    format: ReportFormat,
  ): Promise<{ filename: string; content: string | Blob }> {
    await delay();
    const report = buildAdminReport(id, readAll());
    return withAudit(
      {
        permission: 'reports.export',
        action: 'report.export',
        targetType: 'system',
        targetId: `report:${id}`,
        summary: `Exported the ${report.title} report (${format.toUpperCase()})`,
        after: () => ({ report: id, format }),
      },
      async () => ({
        filename: reportFileName(report, format),
        content:
          format === 'csv'
            ? reportToCSV(report)
            : await generateAdminReportPDF(report, getCurrentAdmin()?.name ?? 'Admin'),
      }),
    );
  },

  /** The builder's preview (no export, so not audited). */
  async preview(spec: BuilderSpec): Promise<BuilderResult> {
    await delay(0);
    requirePermission('reports.export');
    return runBuilder(spec, readAll());
  },

  /** The builder's CSV. Audited, with the dataset, columns and filters used. */
  async exportCustom(spec: BuilderSpec): Promise<{ filename: string; csv: string; rows: number }> {
    await delay();
    const result = runBuilder(spec, readAll());
    const label = datasetById(spec.dataset).label;
    return withAudit(
      {
        permission: 'reports.export',
        action: 'report.export',
        targetType: 'system',
        targetId: `custom:${spec.dataset}`,
        summary: `Exported a custom ${label.toLowerCase()} report (${result.total} rows)`,
        after: () => ({ ...spec, rows: result.total }),
      },
      async () => ({
        filename: `AgriCtec_${label.replace(/\W+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
        csv: builderToCSV(result),
        rows: result.total,
      }),
    );
  },
};
