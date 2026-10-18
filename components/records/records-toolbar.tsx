'use client';

import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { CROP_EMOJI, CROPS } from '@/constants/crops';
import type { Crop, RecordType } from '@/types';

export type RecordTab = 'all' | RecordType;
export type CropFilter = 'all' | Crop;

const TAB_LABELS: Record<RecordTab, string> = {
  all: 'All',
  income: 'Income',
  expense: 'Expenses',
  activity: 'Activities',
};

export interface RecordsToolbarProps {
  tab: RecordTab;
  onTabChange: (tab: RecordTab) => void;
  crop: CropFilter;
  onCropChange: (crop: CropFilter) => void;
  counts: Record<RecordTab, number>;
  onExport: () => void;
  onNew: () => void;
}

export function RecordsToolbar({
  tab,
  onTabChange,
  crop,
  onCropChange,
  counts,
  onExport,
  onNew,
}: RecordsToolbarProps) {
  const tabs = (Object.keys(TAB_LABELS) as RecordTab[]).map((value) => ({
    value,
    label: `${TAB_LABELS[value]} (${counts[value]})`,
  }));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs label="Filter by record type" tabs={tabs} value={tab} onChange={onTabChange} />
        <div className="sm:w-48">
          <Select
            aria-label="Filter by crop"
            value={crop}
            onChange={(event) => onCropChange(event.target.value as CropFilter)}
          >
            <option value="all">All crops</option>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {CROP_EMOJI[c]} {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" icon={Download} onClick={onExport} className="flex-1 sm:flex-none">
          Export CSV
        </Button>
        <Button icon={Plus} onClick={onNew} className="flex-1 sm:flex-none">
          New Record
        </Button>
      </div>
    </div>
  );
}
