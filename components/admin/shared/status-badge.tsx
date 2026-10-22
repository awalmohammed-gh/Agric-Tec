import { Badge, type BadgeColor } from '@/components/ui/badge';
import { LOAN_STATUS_LABELS } from '@/lib/admin/loan-status';
import type {
  AccountStatus,
  AdminUser,
  Announcement,
  LoanStatus,
  RiskFlag,
  VerificationRequest,
} from '@/types/admin';

export type AnnouncementState = 'live' | 'scheduled' | 'ended' | 'off';

/** Every status the console shows, by kind. */
export interface StatusKinds {
  account: AccountStatus;
  verification: VerificationRequest['status'];
  loan: LoanStatus;
  risk: RiskFlag['status'];
  severity: RiskFlag['severity'];
  announcement: AnnouncementState;
  admin: AdminUser['status'];
}
export type StatusKind = keyof StatusKinds;

interface StatusStyle {
  label: string;
  color: BadgeColor;
}

/** The single map from a status to its colour and label (lists, detail modals and detail pages). */
export const STATUS_STYLES: { [K in StatusKind]: Record<StatusKinds[K], StatusStyle> } = {
  account: {
    active: { label: 'Active', color: 'green' },
    suspended: { label: 'Suspended', color: 'red' },
    pending_verification: { label: 'Pending verification', color: 'gold' },
  },
  verification: {
    pending: { label: 'Pending', color: 'gold' },
    approved: { label: 'Approved', color: 'green' },
    rejected: { label: 'Rejected', color: 'red' },
  },
  loan: {
    submitted: { label: LOAN_STATUS_LABELS.submitted, color: 'blue' },
    under_review: { label: LOAN_STATUS_LABELS.under_review, color: 'gold' },
    approved: { label: LOAN_STATUS_LABELS.approved, color: 'green' },
    rejected: { label: LOAN_STATUS_LABELS.rejected, color: 'red' },
    disbursed: { label: LOAN_STATUS_LABELS.disbursed, color: 'purple' },
    repaid: { label: LOAN_STATUS_LABELS.repaid, color: 'green' },
    defaulted: { label: LOAN_STATUS_LABELS.defaulted, color: 'red' },
  },
  risk: {
    open: { label: 'Open', color: 'red' },
    dismissed: { label: 'Dismissed', color: 'blue' },
    confirmed: { label: 'Confirmed', color: 'purple' },
  },
  severity: {
    high: { label: 'High', color: 'red' },
    medium: { label: 'Medium', color: 'gold' },
    low: { label: 'Low', color: 'blue' },
  },
  announcement: {
    live: { label: 'Live', color: 'green' },
    scheduled: { label: 'Scheduled', color: 'blue' },
    ended: { label: 'Ended', color: 'gold' },
    off: { label: 'Off', color: 'red' },
  },
  admin: {
    active: { label: 'Active', color: 'green' },
    disabled: { label: 'Disabled', color: 'red' },
  },
};

export function statusStyle<K extends StatusKind>(kind: K, status: StatusKinds[K]): StatusStyle {
  return STATUS_STYLES[kind][status];
}

/** Where an announcement is in its life: switched off, not started, live or over. */
export function announcementState(a: Announcement, now = new Date()): AnnouncementState {
  const time = now.toISOString();
  if (!a.active) return a.endsAt && a.endsAt <= time ? 'ended' : 'off';
  if (a.startsAt > time) return 'scheduled';
  if (a.endsAt && a.endsAt <= time) return 'ended';
  return 'live';
}

export function StatusBadge<K extends StatusKind>({
  kind,
  status,
  className,
}: {
  kind: K;
  status: StatusKinds[K];
  className?: string;
}) {
  const style = statusStyle(kind, status);
  return (
    <Badge color={style.color} className={className}>
      {style.label}
    </Badge>
  );
}
