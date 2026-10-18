'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, ScanLine, ShieldCheck, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { AnalyzingState } from '@/components/crop-doctor/analyzing-state';
import { DiagnosisCard } from '@/components/crop-doctor/diagnosis-card';
import { DiagnosisHistory } from '@/components/crop-doctor/diagnosis-history';
import { ImagePreview } from '@/components/crop-doctor/image-preview';
import { UploadZone } from '@/components/crop-doctor/upload-zone';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { CROPS } from '@/constants/crops';
import { diagnoseCrop } from '@/lib/ai/crop-diagnosis';
import { todayISO } from '@/lib/format';
import { compressImage } from '@/lib/image/compress';
import { useFarmStore } from '@/store/farm-store';
import type { Crop, DiagnosisResult } from '@/types';

export function CropDoctorView() {
  const [crop, setCrop] = useState<Crop | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const request = useRef(0);
  const saveLock = useRef(false);

  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  function reset() {
    request.current++;
    setFile(null);
    setResult(null);
    setAnalyzing(false);
    setSaving(false);
    setSaved(false);
  }

  async function analyze(image: File, selectedCrop: Crop | '') {
    const version = ++request.current;
    setFile(image);
    setResult(null);
    setSaved(false);
    setAnalyzing(true);
    try {
      const diagnosis = await diagnoseCrop(image, selectedCrop || undefined);
      if (request.current === version) setResult(diagnosis);
    } catch (error) {
      if (request.current === version)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not analyze this image. Please try again.',
        );
    } finally {
      if (request.current === version) setAnalyzing(false);
    }
  }

  async function save() {
    if (!file || !result || saved || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    const version = request.current;
    const userId = useFarmStore.getState().userId;
    try {
      const imageThumb = await compressImage(file);
      if (request.current !== version || !userId || useFarmStore.getState().userId !== userId)
        return;
      await useFarmStore.getState().addDiagnosis({ ...result, date: todayISO(), imageThumb });
      if (request.current === version) {
        setSaved(true);
        toast.success('Diagnosis saved');
      }
    } catch (error) {
      if (request.current === version)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save the diagnosis. Please try again.',
        );
    } finally {
      saveLock.current = false;
      if (request.current === version) setSaving(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus size={17} aria-hidden="true" className="text-ink-green" />
                Upload Crop Image
              </CardTitle>
              <CardSub>A clear, close-up leaf photo works best</CardSub>
            </div>
          </CardHeader>
          <FormField
            label="Which crop is this?"
            htmlFor="diagnosis-crop"
            hint="Optional: helps select a relevant sample diagnosis"
            className="mb-5"
          >
            <Select
              id="diagnosis-crop"
              value={crop}
              disabled={analyzing || saving}
              aria-describedby="diagnosis-crop-hint"
              onChange={(event) => {
                const next = event.target.value as Crop | '';
                setCrop(next);
                if (file) void analyze(file, next);
              }}
            >
              <option value="">Not sure / choose a crop</option>
              {CROPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          {file ? (
            <ImagePreview
              file={file}
              analyzing={analyzing}
              disabled={saving}
              onRemove={reset}
              onError={() => {
                toast.error('This image could not be read. Please try another photo.');
                reset();
              }}
            />
          ) : (
            <UploadZone onFile={(image) => void analyze(image, crop)} disabled={saving} />
          )}
          <p className="text-text-mute mt-4 flex items-center gap-1.5 text-[11px]">
            <ShieldCheck size={13} aria-hidden="true" className="text-ink-green" />
            Your photo stays on this device.
          </p>
        </Card>
        <Card className="rounded-3xl" aria-busy={analyzing}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope size={17} aria-hidden="true" className="text-ink-purple" />
                Diagnosis Result
              </CardTitle>
              <CardSub>Sample insights to help explore the tool</CardSub>
            </div>
          </CardHeader>
          <div aria-live="polite">
            {analyzing ? (
              <AnalyzingState />
            ) : result ? (
              <DiagnosisCard
                result={result}
                saving={saving}
                saved={saved}
                onSave={() => void save()}
                onScanAnother={reset}
              />
            ) : (
              <EmptyState
                icon={ScanLine}
                title="A closer look at your crop"
                description="Upload a photo to explore a sample diagnosis, confidence score and treatment guide."
                className="min-h-80"
              />
            )}
          </div>
        </Card>
      </div>
      <DiagnosisHistory />
    </>
  );
}
