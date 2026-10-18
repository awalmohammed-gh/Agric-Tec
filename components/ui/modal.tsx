'use client';

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Open modals, innermost last: only the top one reacts to Escape and Tab
// (e.g. a ConfirmDialog opened from inside another Modal).
const modalStack: string[] = [];
let bodyOverflowBeforeModals = '';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

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
  const modalId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (modalStack.at(-1) !== modalId) return;
    const panel = panelRef.current;
    if (!panel) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      const items = focusableIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !panel.contains(active);

      if (event.shiftKey && (active === first || active === panel || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  useEffect(() => {
    if (!open || !mounted) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modalStack.length === 0) bodyOverflowBeforeModals = document.body.style.overflow;
    modalStack.push(modalId);
    panelRef.current?.focus();

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = modalStack.lastIndexOf(modalId);
      if (index !== -1) modalStack.splice(index, 1);
      if (modalStack.length === 0) document.body.style.overflow = bodyOverflowBeforeModals;
      // Return focus to whatever opened the modal.
      trigger?.focus();
    };
  }, [open, mounted, modalId]);

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
