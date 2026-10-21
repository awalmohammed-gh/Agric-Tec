'use client';

import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';
import { useMounted } from '@/hooks/use-mounted';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const mounted = useMounted();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Focus trap, Escape, scroll lock and focus return (shared with the admin drawers).
  useDialog({ open, active: mounted, panelRef, onClose });

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-fade-in rounded-card border-border bg-bg-2 shadow-glass relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden border focus:outline-none',
          sizes[size],
          className,
        )}
      >
        <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id={titleId} className="text-text text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-text-dim hover:bg-glass-strong hover:text-text -mr-2 inline-flex size-11 items-center justify-center rounded-xl transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
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
