'use client';

import { Search, X } from 'lucide-react';
import { MultiSelect } from '@/components/admin/shared/multi-select';
import { STATUS_STYLES } from '@/components/admin/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { AdminTableState } from '@/hooks/admin/use-admin-table';
import {
  SCORE_BANDS,
  splitValues,
  VERIFICATION_FILTERS,
  type FarmerFilterName,
} from '@/lib/admin/farmer-list';
import type { FarmerAccount } from '@/types/admin';

const STATUS_OPTIONS = (['active', 'suspended', 'pending_verification'] as const).map((s) => ({
  value: s,
  label: STATUS_STYLES.account[s].label,
}));

const RECORD_OPTIONS = [
  { value: 'yes', label: 'Has records' },
  { value: 'no', label: 'No records' },
];

const FILTER_LABELS: Record<FarmerFilterName, string> = {
  region: 'Region',
  crop: 'Crop',
  status: 'Status',
  band: 'Score',
  verification: 'Verification',
  joinedFrom: 'Joined from',
  joinedTo: 'Joined to',
  records: 'Records',
  tag: 'Tag',
  active: 'Active in',
};

/** A chip's text for an active filter, e.g. "Region: Northern, Ashanti". */
function chipText(name: FarmerFilterName, value: string): string {
  const many = (labels: Record<string, string>) =>
    splitValues(value)
      .map((v) => labels[v] ?? v)
      .join(', ');
  switch (name) {
    case 'status':
      return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
    case 'band':
      return many(Object.fromEntries(SCORE_BANDS.map((b) => [b.value, b.label])));
    case 'verification':
      return VERIFICATION_FILTERS.find((o) => o.value === value)?.label ?? value;
    case 'records':
      return RECORD_OPTIONS.find((o) => o.value === value)?.label ?? value;
    case 'active':
      return `last ${value} days`;
    default:
      return splitValues(value).join(', ');
  }
}

/**
 * Search plus every farmer filter. All of it lives in the URL (via useAdminTable), so a filtered
 * view survives a refresh and can be shared: ?region=Northern&crop=Maize&band=building
 */
export function FarmersFilters({
  table,
  regions,
  crops,
  tags,
}: {
  table: AdminTableState<FarmerAccount>;
  regions: string[];
  crops: string[];
  tags: string[];
}) {
  const value = (name: FarmerFilterName) => table.filters[name] ?? '';
  const set = (name: FarmerFilterName, next: string) => table.setFilter(name, next || null);
  const setMany = (name: FarmerFilterName) => (next: string[]) => set(name, next.join(','));
  const active = (Object.keys(FILTER_LABELS) as FarmerFilterName[]).filter((name) => value(name));

  return (
    <div role="search" aria-label="Find farmers" className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            size={16}
            aria-hidden="true"
            className="text-text-mute pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Search by name, email, phone or farm"
            placeholder="Name, email, phone or farm"
            value={table.query}
            onChange={(e) => table.setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <MultiSelect
          label="Region"
          options={regions.map((r) => ({ value: r, label: r }))}
          value={splitValues(value('region'))}
          onChange={setMany('region')}
        />
        <MultiSelect
          label="Crop"
          options={crops.map((c) => ({ value: c, label: c }))}
          value={splitValues(value('crop'))}
          onChange={setMany('crop')}
        />
        <MultiSelect
          label="Score band"
          options={SCORE_BANDS.map((b) => ({ value: b.value, label: b.label }))}
          value={splitValues(value('band'))}
          onChange={setMany('band')}
        />
        <label>
          <span className="sr-only">Status</span>
          <Select value={value('status')} onChange={(e) => set('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Verification</span>
          <Select
            value={value('verification')}
            onChange={(e) => set('verification', e.target.value)}
          >
            <option value="">Any verification</option>
            {VERIFICATION_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Records</span>
          <Select value={value('records')} onChange={(e) => set('records', e.target.value)}>
            <option value="">With or without records</option>
            {RECORD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Tag</span>
          <Select value={value('tag')} onChange={(e) => set('tag', e.target.value)}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
        <fieldset className="flex items-center gap-2 sm:col-span-2">
          <legend className="sr-only">Signed up between</legend>
          <span className="text-text-mute shrink-0 text-xs">Joined</span>
          <Input
            type="date"
            aria-label="Joined from"
            value={value('joinedFrom')}
            max={value('joinedTo') || undefined}
            onChange={(e) => set('joinedFrom', e.target.value)}
          />
          <span className="text-text-mute text-xs">to</span>
          <Input
            type="date"
            aria-label="Joined to"
            value={value('joinedTo')}
            min={value('joinedFrom') || undefined}
            onChange={(e) => set('joinedTo', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <p className="text-text-dim font-semibold" aria-live="polite">
          {table.total.toLocaleString()} {table.total === 1 ? 'farmer' : 'farmers'} found
        </p>
        {active.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => table.setFilter(name, null)}
            aria-label={`Remove filter ${FILTER_LABELS[name]}: ${chipText(name, value(name))}`}
            className="bg-purple/15 text-ink-purple hover:bg-purple/25 inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors"
          >
            {FILTER_LABELS[name]}: {chipText(name, value(name))}
            <X size={12} aria-hidden="true" />
          </button>
        ))}
        {(active.length > 0 || table.query) && (
          <button
            type="button"
            onClick={table.clearFilters}
            className="text-ink-purple min-h-7 font-semibold hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
