'use client';

import { useEffect, useState } from 'react';
import { seededAt } from '@/lib/admin/seed';
import { configService } from '@/services/admin/config.service';
import { storage } from '@/services/storage';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { CreditConfig, FeatureFlags } from '@/types/admin';

export interface PlatformStatus {
  flags: FeatureFlags;
  creditConfig: CreditConfig;
  seededAt: string | null;
  /** Approximate bytes the app uses in this browser's storage. */
  storageBytes: number;
}

/** Feature flags, credit rules version, seed date and storage use. Reloads with the admin data. */
export function usePlatformStatus(): PlatformStatus | null {
  const loadedAt = useAdminDataStore((s) => s.loadedAt);
  const [status, setStatus] = useState<PlatformStatus | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([configService.getFlags(), configService.getCreditConfig()]).then(
      ([flags, creditConfig]) => {
        if (!active) return;
        setStatus({
          flags,
          creditConfig,
          seededAt: seededAt(),
          storageBytes: storage.usageBytes(),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [loadedAt]);

  return status;
}
