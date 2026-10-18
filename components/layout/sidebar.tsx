'use client';

import Link from 'next/link';
import { Sprout } from 'lucide-react';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profile-store';
import { useUiStore } from '@/store/ui-store';

export const SIDEBAR_ID = 'app-sidebar';

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);
  const profile = useProfileStore((s) => s.profile);

  const name = profile?.name.trim() || 'New Farmer';
  const initial = (profile?.name.trim()[0] ?? 'N').toUpperCase();
  const farmType = profile?.farmType ?? 'Smallholder';

  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className={cn(
        'glass fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-y-0 border-l-0',
        'transition-[transform,visibility] duration-300 ease-out',
        // Always visible from 900px; below that, an off-canvas drawer.
        // `invisible` keeps the hidden drawer's links out of the Tab order.
        'min-[900px]:visible min-[900px]:translate-x-0',
        sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
      )}
    >
      <div className="border-border flex items-center gap-3 border-b px-5 py-5">
        <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#10b981] to-[#34d399] text-white shadow-[0_8px_24px_-6px_var(--accent-glow)]">
          <Sprout size={22} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-gradient-brand font-display text-xl leading-tight font-bold">
            AgriCtec
          </p>
          <p className="text-text-mute text-[10px] tracking-[2px] uppercase">Digital Identity</p>
        </div>
      </div>

      <SidebarNav onNavigate={closeSidebar} />

      <div className="border-border border-t p-3">
        <Link
          href="/profile"
          onClick={closeSidebar}
          className="glass hover:bg-glass-strong flex min-h-11 items-center gap-3 rounded-2xl p-3 transition-colors"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f5c451] to-[#10b981] text-sm font-bold text-[#022c22]"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="text-text block truncate text-sm font-semibold">{name}</span>
            <span className="text-text-mute block truncate text-xs">{farmType} Farmer</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
