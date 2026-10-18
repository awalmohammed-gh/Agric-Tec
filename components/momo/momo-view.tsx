'use client';

import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MomoTable } from '@/components/momo/momo-table';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { downloadFile, toCSV } from '@/lib/export/csv';
import { todayISO } from '@/lib/format';
import { useFarmStore } from '@/store/farm-store';
import { useModalStore } from '@/store/modal-store';

type DirectionFilter = 'all' | 'in' | 'out';

/** The transactions card: filter, export, new, and the table. */
export function MomoView() {
  const momo = useFarmStore((s) => s.momo);
  const openModal = useModalStore((s) => s.openModal);
  const [filter, setFilter] = useState<DirectionFilter>('all');

  const rows = filter === 'all' ? momo : momo.filter((t) => t.direction === filter);
  const received = momo.filter((t) => t.direction === 'in').length;

  function exportCsv() {
    if (rows.length === 0) {
      toast.info('There are no transactions to export with this filter.');
      return;
    }
    const csv = toCSV(rows, [
      { header: 'Date', value: (t) => t.date },
      { header: 'Type', value: (t) => (t.direction === 'in' ? 'Received' : 'Sent') },
      { header: 'Counterparty', value: (t) => t.counterparty },
      { header: 'Network', value: (t) => t.network ?? '' },
      { header: 'Reference', value: (t) => t.reference },
      { header: 'Amount (GHS)', value: (t) => (t.direction === 'in' ? t.amount : -t.amount) },
    ]);
    downloadFile(csv, `AgriCtec_MoMo_${todayISO()}.csv`);
    toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'}`);
  }

  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row">
        <div>
          <CardTitle>Mobile Money Transactions</CardTitle>
          <CardSub>All your MoMo inflows and outflows</CardSub>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="ghost"
            icon={Download}
            onClick={exportCsv}
            className="flex-1 sm:flex-none"
          >
            Export CSV
          </Button>
          <Button icon={Plus} onClick={() => openModal('momo')} className="flex-1 sm:flex-none">
            New Transaction
          </Button>
        </div>
      </CardHeader>

      <Tabs
        label="Filter by direction"
        className="mb-4"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: `All (${momo.length})` },
          { value: 'in', label: `Received (${received})` },
          { value: 'out', label: `Sent (${momo.length - received})` },
        ]}
      />

      <MomoTable rows={rows} isFiltered={momo.length > 0} />
    </Card>
  );
}
