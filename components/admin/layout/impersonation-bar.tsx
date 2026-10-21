'use client';

import { Eye, X } from 'lucide-react';
import { useAdminUiStore } from '@/store/admin/admin-ui-store';

/**
 * Gold bar across the very top while an admin views the app as a farmer (read-only, phase A8).
 * The spec's 👁 is the Eye icon here: the app never renders emoji.
 */
export function ImpersonationBar() {
  const impersonating = useAdminUiStore((s) => s.impersonating);
  const stop = useAdminUiStore((s) => s.stopImpersonation);
  if (!impersonating) return null;

  return (
    <div
      role="status"
      className="bg-gold sticky top-0 z-[60] flex min-h-10 items-center justify-center gap-3 px-4 py-1.5 text-sm font-semibold text-[#3a2a05]"
    >
      <Eye size={16} aria-hidden="true" />
      <span className="truncate">Viewing as {impersonating.name} (read-only)</span>
      <button
        type="button"
        onClick={stop}
        className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-black/10 px-2.5 text-xs font-bold transition-colors hover:bg-black/20"
      >
        <X size={14} aria-hidden="true" />
        Exit
      </button>
    </div>
  );
}
