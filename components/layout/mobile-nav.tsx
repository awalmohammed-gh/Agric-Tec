'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid2x2, LogOut, X } from 'lucide-react';
import { useSignOut } from '@/components/layout/use-sign-out';
import { Badge } from '@/components/ui/badge';
import {
  isNavActive,
  MOBILE_MENU_SECTIONS,
  MOBILE_PRIMARY_NAV,
  type NavItem,
} from '@/constants/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, useProfileStore } from '@/store';
import { useUiStore } from '@/store/ui-store';

/** Icon tile tone per menu section, from the app's existing palette. */
const SECTION_TONES: Record<string, string> = {
  Main: 'bg-accent/15 text-ink-green',
  'AI Powered': 'bg-purple/15 text-ink-purple',
  Finance: 'bg-gold/15 text-ink-gold',
  Account: 'bg-info/15 text-ink-blue',
};

const tileClass =
  'flex min-h-14 w-full items-center gap-3 rounded-2xl border p-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent';

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
  const session = useAuthStore((s) => s.session);
  const profile = useProfileStore((s) => s.profile);
  const { signOut, signingOut } = useSignOut();

  const sheetId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const activeMenuItem = MOBILE_MENU_SECTIONS.flatMap((section) => section.items).find((item) =>
    isNavActive(pathname, item.href),
  );
  const name = profile?.name.trim() || 'New Farmer';
  const initial = (profile?.name.trim()[0] ?? 'N').toUpperCase();

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
          'border-border bg-bg-2/95 shadow-glass fixed inset-x-3 z-40 mx-auto max-w-md origin-bottom overflow-y-auto overscroll-contain rounded-3xl border p-4 backdrop-blur-xl',
          'bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] max-h-[min(72dvh,600px)]',
          'duration-300 ease-out motion-reduce:transition-none',
          // Visible at once on open (so focus can move in); hidden only after the closing slide.
          open
            ? 'visible translate-y-0 scale-100 opacity-100 transition-[transform,opacity]'
            : 'pointer-events-none invisible translate-y-6 scale-95 opacity-0 transition-[transform,opacity,visibility]',
        )}
      >
        <span
          aria-hidden="true"
          className="bg-text-mute/30 mx-auto -mt-1 mb-3 block h-1 w-10 rounded-full"
        />
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f5c451] to-[#10b981] text-sm font-bold text-[#022c22]"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-text truncate text-sm font-bold">
              {name}
            </h2>
            <p className="text-text-mute flex items-center gap-1.5 truncate text-xs">
              {session?.isGuest ? (
                <>
                  Guest user <Badge color="gold">Demo</Badge>
                </>
              ) : (
                (session?.email ?? `${profile?.farmType ?? 'Smallholder'} Farmer`)
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="text-text-dim hover:bg-glass-strong hover:text-text inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="More pages" className="space-y-4">
          {MOBILE_MENU_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-text-mute mb-2 px-1 text-[10px] font-semibold tracking-wider uppercase">
                {section.title}
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          tileClass,
                          active
                            ? 'border-accent/40 bg-accent/10 text-ink-green'
                            : 'border-border bg-glass text-text hover:bg-glass-strong',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
                            SECTION_TONES[section.title] ?? SECTION_TONES.Main,
                          )}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 leading-tight">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
                {section.title === 'Account' && (
                  <li>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      disabled={signingOut}
                      className={cn(
                        tileClass,
                        'border-border bg-glass text-ink-red hover:bg-danger/10 disabled:opacity-60',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="bg-danger/15 inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
                      >
                        <LogOut size={18} />
                      </span>
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </li>
                )}
              </ul>
            </section>
          ))}
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
