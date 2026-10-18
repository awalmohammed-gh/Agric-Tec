'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid2x2, LogOut, X } from 'lucide-react';
import { useSignOut } from '@/components/layout/use-sign-out';
import {
  isNavActive,
  MOBILE_MENU_SECTIONS,
  MOBILE_PRIMARY_NAV,
  type NavItem,
} from '@/constants/navigation';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

/** The seven pages not in the bottom bar, in sidebar order; Sign Out makes the eighth cell. */
const MENU_ITEMS = MOBILE_MENU_SECTIONS.flatMap((section) => section.items);

/** Menu grid cell: icon above a small centred label, no card. At least 64px tall to tap. */
const gridItemClass =
  'flex min-h-16 w-full flex-col items-center justify-start gap-1 rounded-xl px-0.5 py-1.5 text-center transition-colors hover:text-text active:bg-glass-strong focus-visible:outline-2 focus-visible:outline-accent';
const gridLabelClass =
  'text-[10px] leading-tight font-medium [overflow-wrap:break-word] min-[360px]:text-[11px]';

/** Same 48px square for every bar control, so all five icons line up exactly. */
const barSlotClass =
  'relative inline-flex size-12 items-center justify-center rounded-2xl focus-visible:outline-2 focus-visible:outline-accent';

/** One direct destination in the bottom bar: an icon only, named by aria-label. */
function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        barSlotClass,
        'transition-colors duration-200',
        active ? 'bg-accent/15 text-ink-green' : 'text-text-mute hover:text-text',
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      {active && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-[#10b981]"
        />
      )}
    </Link>
  );
}

/**
 * Mobile navigation (below 900px): a floating, icons-only bottom bar with four destinations
 * and a centre Menu button that opens the remaining pages in a bottom sheet above the bar.
 * The backdrop, Escape key and close-on-navigation live in MobileNavOverlay.
 */
export function MobileNav() {
  const pathname = usePathname();
  const open = useUiStore((s) => s.mobileNavOpen);
  const toggle = useUiStore((s) => s.toggleMobileNav);
  const close = useUiStore((s) => s.closeMobileNav);
  const { signOut, signingOut } = useSignOut();

  const sheetId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const activeMenuItem = MOBILE_MENU_SECTIONS.flatMap((section) => section.items).find((item) =>
    isNavActive(pathname, item.href),
  );

  // Move focus into the sheet when it opens, and back to the Menu button when it closes.
  useEffect(() => {
    if (open) {
      sheetRef.current?.querySelector<HTMLElement>('a[href], button')?.focus();
    } else if (wasOpen.current) {
      const focused = document.activeElement;
      if (!focused || focused === document.body || sheetRef.current?.contains(focused)) {
        menuButtonRef.current?.focus({ preventScroll: true });
      }
    }
    wasOpen.current = open;
  }, [open]);

  /** Keeps Tab and Shift+Tab inside the open sheet. */
  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusable = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-[900px]:hidden">
      {/* Bottom sheet with the pages that are not in the bar */}
      <div
        ref={sheetRef}
        id={sheetId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        onKeyDown={trapFocus}
        className={cn(
          'border-border bg-bg-2/95 shadow-glass fixed inset-x-3 z-40 mx-auto max-w-md origin-bottom overflow-y-auto overscroll-contain rounded-3xl border px-3 pt-1 pb-3 backdrop-blur-xl',
          'bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] max-h-[70dvh]',
          'duration-300 ease-out motion-reduce:transition-none',
          // Visible at once on open (so focus can move in); hidden only after the closing slide.
          open
            ? 'visible translate-y-0 scale-100 opacity-100 transition-[transform,opacity]'
            : 'pointer-events-none invisible translate-y-6 scale-95 opacity-0 transition-[transform,opacity,visibility]',
        )}
      >
        {/* Header row: drag handle in the middle, close button on the right */}
        <div className="relative flex h-10 items-center justify-center">
          <h2 id={titleId} className="sr-only">
            More pages
          </h2>
          <span aria-hidden="true" className="bg-text-mute/30 block h-1 w-10 rounded-full" />
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="text-text-dim hover:text-text absolute top-1/2 right-0 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* 4 × 2 icon grid: icon on top, small label underneath, no cards */}
        <nav aria-label="More pages">
          <ul className="grid grid-cols-4 gap-x-1 gap-y-2">
            {MENU_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={cn(gridItemClass, active ? 'text-ink-green' : 'text-text-dim')}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                        active && 'bg-accent/15',
                      )}
                    >
                      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                    </span>
                    <span className={gridLabelClass}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className={cn(gridItemClass, 'text-ink-red disabled:opacity-60')}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-12 items-center justify-center"
                >
                  <LogOut size={22} strokeWidth={1.75} />
                </span>
                <span className={gridLabelClass}>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <nav
        aria-label="Mobile navigation"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <ul className="border-border bg-bg-2/95 pointer-events-auto mx-auto grid h-16 max-w-md grid-cols-5 place-items-center rounded-3xl border px-1 shadow-[0_-4px_30px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl *:flex">
          {MOBILE_PRIMARY_NAV.slice(0, 2).map((item) => (
            <li key={item.href}>
              <BarLink item={item} active={isNavActive(pathname, item.href)} />
            </li>
          ))}
          <li>
            {/* Same 48px slot as the links; the two icons are stacked in one place and
                cross-fade, so nothing moves or resizes when the menu opens. */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggle}
              aria-label={
                open
                  ? 'Close menu'
                  : activeMenuItem
                    ? `Open menu (current page: ${activeMenuItem.label})`
                    : 'Open menu'
              }
              aria-expanded={open}
              aria-controls={sheetId}
              aria-haspopup="dialog"
              className={cn(
                barSlotClass,
                'bg-linear-to-br from-[#34d399] to-[#10b981] text-[#022c22] shadow-[0_8px_20px_-8px_var(--accent-glow)] active:brightness-95',
              )}
            >
              <Grid2x2
                size={22}
                strokeWidth={2.25}
                aria-hidden="true"
                className={cn(
                  'absolute transition-[opacity,transform] duration-200',
                  open ? 'scale-75 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
                )}
              />
              <X
                size={22}
                strokeWidth={2.5}
                aria-hidden="true"
                className={cn(
                  'absolute transition-[opacity,transform] duration-200',
                  open ? 'scale-100 rotate-0 opacity-100' : 'scale-75 -rotate-90 opacity-0',
                )}
              />
              {activeMenuItem && !open && (
                <span
                  aria-hidden="true"
                  className="ring-bg-2 absolute top-1 right-1 size-2.5 rounded-full bg-[#f5c451] ring-2"
                />
              )}
            </button>
          </li>
          {MOBILE_PRIMARY_NAV.slice(2).map((item) => (
            <li key={item.href}>
              <BarLink item={item} active={isNavActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
