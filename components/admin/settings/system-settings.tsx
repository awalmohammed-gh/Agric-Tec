'use client';

import { useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Construction,
  DatabaseBackup,
  Skull,
  Sparkles,
  ToggleRight,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/layout/page-header';
import { BackupRestoreCard } from '@/components/admin/settings/backup-restore';
import { DangerZoneCard } from '@/components/admin/settings/danger-zone';
import { DemoDataCard } from '@/components/admin/settings/demo-data';
import { FeatureFlagsCard } from '@/components/admin/settings/feature-flags';
import { MaintenanceModeCard } from '@/components/admin/settings/maintenance-mode';
import { PlansEditor } from '@/components/admin/settings/plans-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { seededAt } from '@/lib/admin/seed';
import { cn } from '@/lib/utils';
import { configService } from '@/services/admin/config.service';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { FeatureFlags, Plan } from '@/types/admin';

const SECTIONS: { id: string; label: string; icon: LucideIcon; danger?: boolean }[] = [
  { id: 'features', label: 'Feature flags', icon: ToggleRight },
  { id: 'maintenance', label: 'Maintenance', icon: Construction },
  { id: 'plans', label: 'Plans', icon: BadgeDollarSign },
  { id: 'backup', label: 'Backup & restore', icon: DatabaseBackup },
  { id: 'demo', label: 'Demo data', icon: Sparkles },
  { id: 'danger', label: 'Danger zone', icon: Skull, danger: true },
];

/**
 * System settings (phase A14, Super Admin only): feature flags, maintenance mode, plans, backups,
 * the demo world and the danger zone. Every change is audited and reaches the farmer app.
 */
export function SystemSettings() {
  const refreshAdmin = useAdminDataStore((s) => s.refresh);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const syncVersion = useAdminDataStore((s) => s.syncVersion);
  const [active, setActive] = useState('features');

  useEffect(() => {
    let alive = true;
    Promise.all([configService.getFlags(), configService.getPlans()]).then(([f, p]) => {
      if (!alive) return;
      setFlags(f);
      setPlans(p);
      setSeeded(seededAt());
    });
    return () => {
      alive = false;
    };
  }, [version, syncVersion]);

  // Highlight the section in view in the side menu.
  useEffect(() => {
    if (!flags) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [flags]);

  /** After a restore, a reset or a deletion: reload everything (and the console's data). */
  function reloadAll() {
    setVersion((v) => v + 1);
    void refreshAdmin();
  }

  function savedFlags(next: FeatureFlags) {
    setFlags(next);
    void refreshAdmin();
    toast.dismiss('flags');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System settings"
        description="Control what farmers can use, keep the platform safe, and manage its data. Every change is recorded in the audit log."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-24">
          <ul className="-mx-4 flex scrollbar-none gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0 [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map(({ id, label, icon: Icon, danger }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'true' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold transition-colors lg:border-transparent',
                    active === id
                      ? danger
                        ? 'border-danger/40 bg-danger/10 text-ink-red'
                        : 'border-purple/40 bg-purple/12 text-text'
                      : cn(
                          'border-border text-text-dim hover:text-text hover:bg-glass',
                          danger && 'text-ink-red/80',
                        ),
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {!flags || !plans ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
          ) : (
            <>
              <FeatureFlagsCard flags={flags} onSaved={savedFlags} />
              <MaintenanceModeCard
                key={`${flags.maintenanceMode}`}
                flags={flags}
                onSaved={savedFlags}
              />
              <PlansEditor key={JSON.stringify(plans)} plans={plans} onSaved={setPlans} />
              <BackupRestoreCard onRestored={reloadAll} />
              <DemoDataCard seededAt={seeded} onReset={reloadAll} />
              <DangerZoneCard onDeleted={reloadAll} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
