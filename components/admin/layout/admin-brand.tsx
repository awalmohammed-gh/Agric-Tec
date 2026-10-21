import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "AgriCtec" with a gold tag ("ADMIN CONSOLE" on the login card, "CONSOLE" in the sidebar). */
export function AdminBrand({
  tag = 'Admin Console',
  className,
}: {
  tag?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#7c3aed] to-[#a855f7] text-white shadow-[0_8px_24px_-6px_rgba(168,85,247,0.55)]">
        <ShieldCheck size={22} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-text text-xl leading-tight font-bold">AgriCtec</p>
        <span className="bg-gold/20 text-ink-gold ring-gold/50 mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[1.5px] uppercase ring-1">
          {tag}
        </span>
      </div>
    </div>
  );
}
