'use client';

import { useState } from 'react';
import { BadgeCheck, Check, MapPin, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import type { TabProps } from '@/components/admin/farmers/detail/types';
import { StatusBadge } from '@/components/admin/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/admin/use-can';
import { formatDate, formatGPS } from '@/lib/format';
import { maskGhanaCard } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { verificationsService } from '@/services/admin/verifications.service';
import type { VerificationKind, VerificationRequest } from '@/types/admin';

const KIND_LABEL: Record<VerificationKind, string> = {
  phone: 'Phone',
  location: 'Location',
  ghanaCard: 'Ghana Card',
};

/** The three checks, the request history, and inline approve/reject for reviewers. */
export function VerificationTab({ data, reload }: TabProps) {
  const canReview = useCan('verifications.review');
  const { profile } = data.detail.account;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VerificationRequest | null>(null);
  const [reason, setReason] = useState('');

  const checks = [
    {
      kind: 'phone' as const,
      icon: Smartphone,
      done: profile.verification.phone,
      detail: profile.phone || 'No phone number',
    },
    {
      kind: 'location' as const,
      icon: MapPin,
      done: profile.verification.location,
      detail: profile.gps ? formatGPS(profile.gps.lat, profile.gps.lng) : 'No farm location',
    },
    {
      kind: 'ghanaCard' as const,
      icon: BadgeCheck,
      done: profile.verification.ghanaCard,
      detail: maskGhanaCard(profile.ghanaCardLast4),
    },
  ];

  async function approve(request: VerificationRequest) {
    setBusyId(request.id);
    try {
      await verificationsService.approve(request.id);
      toast.success(`${KIND_LABEL[request.kind]} approved`);
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not approve');
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await verificationsService.reject(rejecting.id, reason);
      toast.success(`${KIND_LABEL[rejecting.kind]} rejected`);
      setRejecting(null);
      setReason('');
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not reject');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {checks.map(({ kind, icon: Icon, done, detail }) => (
          <li
            key={kind}
            className={cn(
              'rounded-2xl border p-4',
              done ? 'border-accent/30 bg-accent/5' : 'border-border bg-glass',
            )}
          >
            <div className="flex items-center justify-between">
              <Icon
                size={20}
                aria-hidden="true"
                className={done ? 'text-ink-green' : 'text-text-mute'}
              />
              <StatusBadge kind="verification" status={done ? 'approved' : 'pending'} />
            </div>
            <p className="text-text mt-3 text-sm font-semibold">{KIND_LABEL[kind]}</p>
            <p className="text-text-mute mt-0.5 text-xs break-words">{detail}</p>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Request history</CardTitle>
            <CardSub>Every check this farmer submitted, newest first</CardSub>
          </div>
        </CardHeader>
        {data.verifications === null ? (
          <p className="text-text-mute text-sm">Your role can’t view verification requests.</p>
        ) : data.verifications.length === 0 ? (
          <p className="text-text-mute text-sm">No requests yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {data.verifications.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-text text-sm font-semibold">
                    {KIND_LABEL[request.kind]}{' '}
                    <span className="text-text-mute font-mono text-xs font-normal">
                      {request.submittedValue}
                    </span>
                  </p>
                  <p className="text-text-mute text-xs">
                    Submitted {formatDate(new Date(request.submittedAt))}
                    {request.reviewedBy && ` · reviewed by ${request.reviewedBy}`}
                    {request.reason && ` · ${request.reason}`}
                  </p>
                </div>
                <StatusBadge kind="verification" status={request.status} />
                {canReview && request.status === 'pending' && (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      icon={Check}
                      loading={busyId === request.id}
                      onClick={() => void approve(request)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={X}
                      disabled={busyId === request.id}
                      onClick={() => setRejecting(request)}
                    >
                      Reject
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting ? KIND_LABEL[rejecting.kind] : ''} check`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={X}
              loading={busyId === rejecting?.id}
              disabled={reason.trim().length < 3}
              onClick={() => void reject()}
            >
              Reject
            </Button>
          </>
        }
      >
        <FormField label="Reason (the farmer sees this)" htmlFor="reject-reason">
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The photo of the card is unreadable."
          />
        </FormField>
      </Modal>
    </div>
  );
}
