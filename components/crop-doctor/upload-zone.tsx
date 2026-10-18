'use client';

import { useId, useRef, useState, useSyncExternalStore } from 'react';
import { CloudUpload, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { imageValidationError } from '@/lib/image/compress';
import { cn } from '@/lib/utils';

function subscribeCameraMode(onChange: () => void) {
  const media = window.matchMedia('(pointer: coarse)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const cameraMode = () => window.matchMedia('(pointer: coarse)').matches;
const serverCameraMode = () => false;

export function UploadZone({
  onFile,
  disabled = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const mobile = useSyncExternalStore(subscribeCameraMode, cameraMode, serverCameraMode);
  const hintId = useId();

  function acceptFile(file?: File) {
    if (!file || disabled) return;
    const error = imageValidationError(file);
    if (error) return toast.error(error);
    onFile(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture={mobile ? 'environment' : undefined}
        className="hidden"
        tabIndex={-1}
        aria-label="Choose a crop image"
        disabled={disabled}
        onChange={(event) => {
          acceptFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload crop image"
        aria-describedby={hintId}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            dragDepth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          acceptFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          'group flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors',
          dragging
            ? 'border-accent bg-accent/10'
            : 'border-border bg-bg-2/40 hover:border-accent/50 hover:bg-accent/5',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        <span className="border-accent/20 bg-accent/10 text-ink-green mb-4 inline-flex size-14 items-center justify-center rounded-2xl border">
          <CloudUpload size={27} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-text text-sm font-semibold">
          {dragging ? 'Drop your crop image here' : 'Click to upload or drag an image'}
        </p>
        <p id={hintId} className="text-text-mute mt-2 text-xs">
          PNG, JPG or WEBP up to 10MB
        </p>
        <span className="text-ink-green mt-5 inline-flex items-center gap-1.5 text-xs font-semibold">
          <ImagePlus size={14} aria-hidden="true" />
          Choose a clear leaf photo
        </span>
      </div>
    </>
  );
}
