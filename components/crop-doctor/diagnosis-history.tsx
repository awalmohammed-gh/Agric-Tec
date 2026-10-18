'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { History, Leaf, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEVERITY_COLORS } from '@/components/crop-doctor/diagnosis-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/format';
import { useFarmStore } from '@/store/farm-store';
import type { Diagnosis } from '@/types';

export function DiagnosisHistory() {
  const diagnoses = useFarmStore((state) => state.diagnoses);
  const deleteDiagnosis = useFarmStore((state) => state.deleteDiagnosis);
  const [selected, setSelected] = useState<Diagnosis | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);

  async function remove() {
    if (!selected || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    try {
      await deleteDiagnosis(selected.id);
      setSelected(null);
      toast.success('Diagnosis deleted');
    } catch {
      toast.error('Could not delete the diagnosis. Please try again.');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <History size={17} aria-hidden="true" className="text-ink-green" />
            Recent Diagnoses
          </CardTitle>
          <CardSub>Your last 10 saved scans, stored on this device</CardSub>
        </div>
        <Badge>{Math.min(diagnoses.length, 10)} saved</Badge>
      </CardHeader>
      {diagnoses.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="No diagnoses yet"
          description="Save a diagnosis after scanning a crop photo to build your history."
        />
      ) : (
        <ul className="divide-border divide-y">
          {diagnoses.slice(0, 10).map((diagnosis) => (
            <li key={diagnosis.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
              {diagnosis.imageThumb ? (
                <Image
                  src={diagnosis.imageThumb}
                  width={64}
                  height={64}
                  alt={`Saved ${diagnosis.crop ?? 'crop'} photo`}
                  unoptimized
                  className="border-border size-14 shrink-0 rounded-xl border object-cover sm:size-16"
                />
              ) : (
                <span className="bg-accent/10 text-ink-green inline-flex size-14 shrink-0 items-center justify-center rounded-xl">
                  <Leaf size={23} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-text text-sm font-semibold">{diagnosis.disease}</p>
                  <Badge color={SEVERITY_COLORS[diagnosis.severity]}>{diagnosis.severity}</Badge>
                </div>
                <p className="text-text-mute mt-1.5 text-xs">
                  {formatDate(diagnosis.date)} · {diagnosis.confidence}% confidence
                  {diagnosis.crop ? ` · ${diagnosis.crop}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                aria-label={`Delete ${diagnosis.disease} diagnosis`}
                onClick={() => setSelected(diagnosis)}
                className="text-ink-red size-9 shrink-0 px-0"
              />
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={selected !== null}
        title="Delete diagnosis?"
        message="This removes the saved diagnosis and its thumbnail from your history."
        confirmLabel="Delete diagnosis"
        danger
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!deleting) setSelected(null);
        }}
      />
    </Card>
  );
}
