// Replace the body of diagnoseCrop with a call to a real plant-disease vision API later;
// keep the same input/output types so the upload and result components do not change.
import { MOCK_DIAGNOSES } from '@/data/mock/diagnoses';
import { imageValidationError } from '@/lib/image/compress';
import { delay } from '@/services/storage';
import type { Crop, DiagnosisResult } from '@/types';

export async function diagnoseCrop(file: File, crop?: Crop): Promise<DiagnosisResult> {
  const validationError = imageValidationError(file);
  if (validationError) throw new Error(validationError);
  await delay(1500);

  // This is a repeatable demonstration, not image recognition. Metadata seeds the pick.
  let hash = 2166136261;
  for (const character of `${file.name}:${file.size}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const candidates = crop
    ? MOCK_DIAGNOSES.filter((diagnosis) => diagnosis.crop === crop || !diagnosis.crop)
    : MOCK_DIAGNOSES;
  const diagnosis = candidates[hash % candidates.length];
  return { ...diagnosis, crop: crop ?? diagnosis.crop };
}
