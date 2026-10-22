'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppWindow,
  Ban,
  BadgeCheck,
  Download,
  Eye,
  KeyRound,
  MapPin,
  RotateCcw,
  ScanSearch,
  Smartphone,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/layout/page-header';
import { AdminTable, type AdminColumn } from '@/components/admin/shared/admin-table';
import { RowMenu, type RowMenuItem } from '@/components/admin/shared/row-menu';
import { StatusBadge } from '@/components/admin/shared/status-badge';
import { AddNoteDialog, ReactivateDialog } from '@/components/admin/farmers/farmer-action-dialogs';
import { ResetPasswordDialog } from '@/components/admin/farmers/detail/reset-password-dialog';
import { FarmerQuickViewModal } from '@/components/admin/farmers/farmer-quick-view-modal';
import { csvFileName, FarmersBulkActions } from '@/components/admin/farmers/farmers-bulk-actions';
import { FarmersFilters } from '@/components/admin/farmers/farmers-filters';
import { SuspendDialog } from '@/components/admin/farmers/suspend-dialog';
import { TagEditor } from '@/components/admin/farmers/tag-editor';
import { useViewAsFarmer } from '@/components/admin/farmers/use-view-as-farmer';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CROP_TONES, CropIcon, cropFromName } from '@/components/ui/crop-icon';
import { useAdminTable } from '@/hooks/admin/use-admin-table';
import { useAdminRole } from '@/hooks/admin/use-can';
import { usePlatformStatus } from '@/hooks/admin/use-platform-status';
import {
  farmerAbilities,
  farmerCountSummary,
  farmerFilterFns,
  FARMER_SEARCH_KEYS,
  FARMER_SORT,
} from '@/lib/admin/farmer-list';
import { scoreLabel } from '@/lib/calculations/credit-score';
import { downloadFile } from '@/lib/export/csv';
import { formatCompactGHS, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { farmersService } from '@/services/admin/farmers.service';
import { riskService } from '@/services/admin/risk.service';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { FarmerAccount } from '@/types/admin';

const BAND_COLOR: Record<string, BadgeColor> = {
  Building: 'red',
  Fair: 'gold',
  Good: 'green',
  Excellent: 'purple',
};

const nameOf = (f: FarmerAccount) => f.profile.name || f.email;

type Dialog =
  | { type: 'suspend'; farmers: FarmerAccount[] }
  | { type: 'reactivate'; farmer: FarmerAccount }
  | { type: 'reset'; farmer: FarmerAccount }
  | { type: 'note'; farmer: FarmerAccount }
  | { type: 'tag'; farmers: FarmerAccount[] }
  | null;

/** Three small icons: phone, location, Ghana Card (green when verified). */
function VerifiedIcons({ farmer }: { farmer: FarmerAccount }) {
  const v = farmer.profile.verification;
  const items = [
    { label: 'Phone', icon: Smartphone, done: v.phone },
    { label: 'Location', icon: MapPin, done: v.location },
    { label: 'Ghana Card', icon: BadgeCheck, done: v.ghanaCard },
  ];
  return (
    <span className="inline-flex items-center gap-1">
      {items.map(({ label, icon: Icon, done }) => (
        <Icon
          key={label}
          size={15}
          aria-label={`${label} ${done ? 'verified' : 'not verified'}`}
          className={done ? 'text-ink-green' : 'text-text-mute/50'}
        />
      ))}
    </span>
  );
}

/** The farmers list: search, filters (in the URL), sort, pagination, row and bulk actions. */
export function FarmersTable() {
  const router = useRouter();
  const role = useAdminRole();
  const abilities = farmerAbilities(role);
  const farmers = useAdminDataStore((s) => s.farmers);
  const status = useAdminDataStore((s) => s.status);
  const refresh = useAdminDataStore((s) => s.refresh);
  const viewAsFarmer = useViewAsFarmer();
  const bands = usePlatformStatus()?.creditConfig.bands;
  const [quickView, setQuickView] = useState<FarmerAccount | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [scanning, setScanning] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Guests are a shared demo account, not farmers, so the list leaves them out.
  const people = farmers.filter((f) => !f.isGuest);
  const table = useAdminTable(people, {
    getRowId: (f) => f.userId,
    searchKeys: FARMER_SEARCH_KEYS,
    filters: farmerFilterFns(bands),
    sortAccessors: FARMER_SORT,
    initialSort: { key: 'joined', dir: 'desc' },
  });

  const regions = [...new Set(people.map((f) => f.profile.region))].sort();
  const crops = [...new Set(people.flatMap((f) => f.profile.primaryCrops))].sort();
  const tags = [...new Set(people.flatMap((f) => f.tags))].sort();

  async function afterChange() {
    setDialog(null);
    setQuickView(null);
    table.clearSelection();
    await refresh();
  }

  async function runScan() {
    setScanning(true);
    try {
      const found = await riskService.runScan();
      toast.success(
        found.length
          ? `${found.length} new risk flag${found.length === 1 ? '' : 's'} found`
          : 'No new risks found',
      );
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not run the scan');
    } finally {
      setScanning(false);
    }
  }

  async function exportFiltered() {
    setExporting(true);
    try {
      const ids = table.filteredRows.map((f) => f.userId);
      downloadFile(await farmersService.exportCSV(ids), csvFileName('filtered'));
      toast.success(`Exported ${ids.length} farmer${ids.length === 1 ? '' : 's'}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not export');
    } finally {
      setExporting(false);
    }
  }

  function menuItems(farmer: FarmerAccount): RowMenuItem[] {
    return [
      {
        label: 'View details',
        icon: UserRound,
        onSelect: () => router.push(`/admin/farmers/${farmer.userId}`),
      },
      { label: 'Quick view', icon: AppWindow, onSelect: () => setQuickView(farmer) },
      ...(abilities.suspend
        ? [
            farmer.status === 'suspended'
              ? {
                  label: 'Reactivate',
                  icon: RotateCcw,
                  onSelect: () => setDialog({ type: 'reactivate', farmer }),
                }
              : {
                  label: 'Suspend',
                  icon: Ban,
                  danger: true,
                  onSelect: () => setDialog({ type: 'suspend', farmers: [farmer] }),
                },
          ]
        : []),
      ...(abilities.resetPassword
        ? [
            {
              label: 'Reset password',
              icon: KeyRound,
              onSelect: () => setDialog({ type: 'reset', farmer }),
            },
          ]
        : []),
      ...(abilities.addNote
        ? [
            {
              label: 'Add note',
              icon: StickyNote,
              onSelect: () => setDialog({ type: 'note', farmer }),
            },
          ]
        : []),
      ...(abilities.impersonate
        ? [{ label: 'View as farmer', icon: Eye, onSelect: () => void viewAsFarmer(farmer) }]
        : []),
    ];
  }

  const columns: AdminColumn<FarmerAccount>[] = [
    {
      key: 'farmer',
      header: 'Farmer',
      sortable: true,
      primary: true,
      cell: (f) => (
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#a855f7] to-[#f5c451] text-xs font-bold text-[#1e1033]"
          >
            {(nameOf(f)[0] ?? '?').toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{nameOf(f)}</span>
            <span className="text-text-mute block truncate text-xs font-normal">{f.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'region', header: 'Region', sortable: true, cell: (f) => f.profile.region },
    {
      key: 'crops',
      header: 'Crops',
      sortable: true,
      hideOnMobile: true,
      cell: (f) => (
        <span className="flex flex-wrap gap-1">
          {f.profile.primaryCrops.map((name) => {
            const crop = cropFromName(name);
            return (
              <span
                key={name}
                title={name}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  CROP_TONES[crop],
                )}
              >
                <CropIcon crop={crop} size={12} />
                {name}
              </span>
            );
          })}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      cell: (f) => {
        const label = scoreLabel(f.stats.score, bands);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-text font-semibold tabular-nums">{f.stats.score}</span>
            <Badge color={BAND_COLOR[label]}>{label}</Badge>
          </span>
        );
      },
    },
    {
      key: 'records',
      header: 'Records',
      sortable: true,
      align: 'right',
      hideOnMobile: true,
      cell: (f) => f.stats.records,
    },
    {
      key: 'income',
      header: 'Income',
      sortable: true,
      align: 'right',
      cell: (f) => formatCompactGHS(f.stats.income),
    },
    {
      key: 'verified',
      header: 'Verified',
      sortable: true,
      hideOnMobile: true,
      cell: (f) => <VerifiedIcons farmer={f} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (f) => <StatusBadge kind="account" status={f.status} />,
    },
    {
      key: 'joined',
      header: 'Joined',
      sortable: true,
      hideOnMobile: true,
      cell: (f) => <span className="whitespace-nowrap">{formatDate(new Date(f.createdAt))}</span>,
    },
    {
      key: 'menu',
      header: 'Actions',
      className: 'w-12',
      cell: (f) => <RowMenu label={`Actions for ${nameOf(f)}`} items={menuItems(f)} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="All Farmers"
        description={farmerCountSummary(farmers)}
        actions={
          <>
            {abilities.riskScan && (
              <Button
                variant="ghost"
                icon={ScanSearch}
                loading={scanning}
                onClick={() => void runScan()}
              >
                Run risk scan
              </Button>
            )}
            {abilities.export && (
              <Button
                variant="ghost"
                icon={Download}
                loading={exporting}
                disabled={table.total === 0}
                onClick={() => void exportFiltered()}
              >
                Export all filtered
              </Button>
            )}
          </>
        }
        className="mb-0"
      />

      <FarmersFilters table={table} regions={regions} crops={crops} tags={tags} />

      <AdminTable
        table={table}
        columns={columns}
        getRowId={(f) => f.userId}
        caption="Farmers"
        selectable={abilities.select}
        rowLabel={nameOf}
        onRowClick={setQuickView}
        loading={status === 'loading' && people.length === 0}
      />

      {abilities.select && (
        <FarmersBulkActions
          selected={table.selectedRows}
          abilities={abilities}
          onClear={table.clearSelection}
          onSuspend={(list) => setDialog({ type: 'suspend', farmers: list })}
          onTag={(list) => setDialog({ type: 'tag', farmers: list })}
        />
      )}

      <FarmerQuickViewModal
        key={quickView?.userId ?? 'closed'}
        farmer={quickView}
        onClose={() => setQuickView(null)}
        canSuspend={abilities.suspend}
        onSuspend={(f) => setDialog({ type: 'suspend', farmers: [f] })}
        onReactivate={(f) => setDialog({ type: 'reactivate', farmer: f })}
      />

      <SuspendDialog
        farmers={dialog?.type === 'suspend' ? dialog.farmers : []}
        onClose={() => setDialog(null)}
        onDone={() => void afterChange()}
      />
      <TagEditor
        farmers={dialog?.type === 'tag' ? dialog.farmers : []}
        knownTags={tags}
        onClose={() => setDialog(null)}
        onDone={() => void afterChange()}
      />
      <ReactivateDialog
        farmer={dialog?.type === 'reactivate' ? dialog.farmer : null}
        onClose={() => setDialog(null)}
        onDone={() => void afterChange()}
      />
      <ResetPasswordDialog
        farmer={dialog?.type === 'reset' ? dialog.farmer : null}
        onClose={() => setDialog(null)}
      />
      <AddNoteDialog
        farmer={dialog?.type === 'note' ? dialog.farmer : null}
        onClose={() => setDialog(null)}
        onDone={() => void afterChange()}
      />
    </div>
  );
}
