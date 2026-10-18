'use client';

import { useEffect, useRef } from 'react';
import { FileImage, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from '@/components/crop-doctor/image-preview.module.css';

export function ImagePreview({
  file,
  analyzing,
  disabled,
  onRemove,
  onError,
}: {
  file: File;
  analyzing: boolean;
  disabled: boolean;
  onRemove: () => void;
  onError: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div>
      <div
        className="border-border bg-bg-2 relative flex h-64 items-center justify-center overflow-hidden rounded-2xl border"
        aria-busy={analyzing}
      >
        {/* A local blob preview needs native image loading, not the Next.js optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          alt="Uploaded crop for diagnosis"
          onError={onError}
          className="size-full object-contain"
        />
        {analyzing && <div aria-hidden="true" className={styles.scanLine} />}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <FileImage size={16} aria-hidden="true" className="text-ink-green shrink-0" />
        <p className="text-text-dim min-w-0 flex-1 truncate text-xs" title={file.name}>
          {file.name}
        </p>
        <Button size="sm" variant="ghost" icon={X} onClick={onRemove} disabled={disabled}>
          Remove
        </Button>
      </div>
    </div>
  );
}
