'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  RecordsToolbar,
  type CropFilter,
  type RecordTab,
} from '@/components/records/records-toolbar';
import { RecordsTable } from '@/components/records/records-table';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { downloadFile, toCSV } from '@/lib/export/csv';
import { todayISO } from '@/lib/format';
import { useFarmStore } from '@/store/farm-store';
import { useModalStore } from '@/store/modal-store';
import type { FarmRecord } from '@/types';

const TYPE_LABEL: Record<FarmRecord['type'], string> = {
  income: 'Income',
  expense: 'Expense',
  activity: 'Activity',
};

/** Holds the filter state shared by the toolbar and the table. */
export function RecordsView() {
  const records = useFarmStore((s) => s.records);
  const openModal = useModalStore((s) => s.openModal);
  const [tab, setTab] = useState<RecordTab>('all');
  const [crop, setCrop] = useState<CropFilter>('all');

  const byCrop = crop === 'all' ? records : records.filter((r) => r.crop === crop);
  const rows = tab === 'all' ? byCrop : byCrop.filter((r) => r.type === tab);
  const counts: Record<RecordTab, number> = {
    all: byCrop.length,
    income: byCrop.filter((r) => r.type === 'income').length,
    expense: byCrop.filter((r) => r.type === 'expense').length,
    activity: byCrop.filter((r) => r.type === 'activity').length,
  };

  function exportCsv() {
    if (rows.length === 0) {
      toast.info('There are no records to export with these filters.');
      return;
    }
    const csv = toCSV(rows, [
      { header: 'Date', value: (r) => r.date },
      { header: 'Type', value: (r) => TYPE_LABEL[r.type] },
      { header: 'Description', value: (r) => r.description },
      { header: 'Crop', value: (r) => r.crop },
      {
        // Signed so the column sums to net profit; activities have no amount.
        header: 'Amount (GHS)',
        value: (r) => (r.type === 'activity' ? '' : r.type === 'income' ? r.amount : -r.amount),
      },
      { header: 'Notes', value: (r) => r.notes ?? '' },
    ]);
    downloadFile(csv, `AgriCtec_Records_${todayISO()}.csv`);
    toast.success(`Exported ${rows.length} record${rows.length === 1 ? '' : 's'}`);
  }

  return (
    <div className="space-y-4">
      <RecordsToolbar
        tab={tab}
        onTabChange={setTab}
        crop={crop}
        onCropChange={setCrop}
        counts={counts}
        onExport={exportCsv}
        onNew={() => openModal('record')}
      />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Record History</CardTitle>
            <CardSub>
              Showing {rows.length} of {records.length} record{records.length === 1 ? '' : 's'}
            </CardSub>
          </div>
        </CardHeader>
        <RecordsTable rows={rows} isFiltered={records.length > 0} />
      </Card>
    </div>
  );
}
