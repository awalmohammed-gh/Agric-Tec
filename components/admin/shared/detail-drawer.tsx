'use client';

import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import { useMounted } from '@/hooks/use-mounted';

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Actions pinned to the bottom of the panel. */
  footer?: ReactNode;
}

/**
 * Right-side panel for a row's details: 480px wide (full width on phones), focus trapped
 * inside, Escape or the backdrop closes it, and focus returns to the row that opened it.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DetailDrawerProps) {
  const mounted = useMounted();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog({ open, active: mounted, panelRef, onClose });

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="animate-slide-in border-border bg-bg-2 shadow-glass relative flex h-full w-full flex-col border-l focus:outline-none sm:w-[480px]"
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-text truncate text-base font-bold">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="text-text-dim mt-0.5 text-xs">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-text-dim hover:bg-glass-strong hover:text-text -mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
