'use client';

import { useEffect, useEffectEvent, useId, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Open dialogs (modals, drawers), innermost last: only the top one reacts to Escape and Tab
// (e.g. a ConfirmDialog opened from inside a drawer).
const dialogStack: string[] = [];
let bodyOverflowBeforeDialogs = '';

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

/**
 * Shared behaviour of every dialog-like panel: focus moves into the panel, Tab stays inside it,
 * Escape closes the top-most one, the page behind can't scroll, and focus returns to whatever
 * opened it. `active` is false until the panel is actually rendered (e.g. before mounting).
 */
export function useDialog({
  open,
  active = true,
  panelRef,
  onClose,
}: {
  open: boolean;
  active?: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}): void {
  const dialogId = useId();

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (dialogStack.at(-1) !== dialogId) return;
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
      const focused = document.activeElement;
      const outside = !(focused instanceof Node) || !panel.contains(focused);

      if (event.shiftKey && (focused === first || focused === panel || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focused === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  useEffect(() => {
    if (!open || !active) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialogStack.length === 0) bodyOverflowBeforeDialogs = document.body.style.overflow;
    dialogStack.push(dialogId);
    panelRef.current?.focus();

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = dialogStack.lastIndexOf(dialogId);
      if (index !== -1) dialogStack.splice(index, 1);
      if (dialogStack.length === 0) document.body.style.overflow = bodyOverflowBeforeDialogs;
      // Return focus to whatever opened the dialog.
      trigger?.focus();
    };
  }, [open, active, dialogId, panelRef]);
}
