'use client';

import { useState } from 'react';
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { CROP_EMOJI } from '@/constants/crops';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFarmStore } from '@/store/farm-store';
import { useModalStore } from '@/store/modal-store';
import type { FarmRecord, RecordType } from '@/types';

const TYPE_BADGE: Record<RecordType, { label: string; color: BadgeColor }> = {
  income: { label: 'Income', color: 'green' },
  expense: { label: 'Expense', color: 'red' },
  activity: { label: 'Activity', color: 'blue' },
};

/** +GHS for income, −GHS for expenses, and a dash for activities (never "+GHS 0"). */
function Amount({ record }: { record: FarmRecord }) {
  if (record.type === 'activity') {
    return (
      <span className="text-text-mute" aria-label="No amount">
        —
      </span>
    );
  }
  const income = record.type === 'income';
  return (
    <span
      className={cn('font-semibold whitespace-nowrap', income ? 'text-ink-green' : 'text-ink-red')}
    >
      {income ? '+' : '−'}
      {formatGHS(record.amount)}
    </span>
  );
}

function Description({ record }: { record: FarmRecord }) {
  return (
    <div className="min-w-0">
      <p className="text-text break-words">{record.description}</p>
      {record.notes && <p className="text-text-mute mt-0.5 text-xs break-words">{record.notes}</p>}
    </div>
  );
}

function RowActions({
  record,
  onEdit,
  onDelete,
  large = false,
}: {
  record: FarmRecord;
  onEdit: (record: FarmRecord) => void;
  onDelete: (record: FarmRecord) => void;
  large?: boolean;
}) {
  const buttonClass = cn(
    'inline-flex items-center justify-center rounded-lg text-text-dim transition-colors hover:bg-glass-strong',
    large ? 'size-11' : 'size-9',
  );
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(record)}
        aria-label={`Edit record: ${record.description}`}
        className={cn(buttonClass, 'hover:text-text')}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(record)}
        aria-label={`Delete record: ${record.description}`}
        className={cn(buttonClass, 'hover:text-ink-red')}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function RecordsTable({ rows, isFiltered }: { rows: FarmRecord[]; isFiltered: boolean }) {
  const openModal = useModalStore((s) => s.openModal);
  const deleteRecord = useFarmStore((s) => s.deleteRecord);
  const [pendingDelete, setPendingDelete] = useState<FarmRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onEdit = (record: FarmRecord) => openModal('record', record.id);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRecord(pendingDelete.id);
      toast.success('Record deleted');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the record');
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<FarmRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (r) => r.date,
      render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <Badge color={TYPE_BADGE[r.type].color}>{TYPE_BADGE[r.type].label}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-xs',
      render: (r) => <Description record={r} />,
    },
    {
      key: 'crop',
      header: 'Crop',
      render: (r) => (
        <span className="whitespace-nowrap">
          <span aria-hidden="true">{CROP_EMOJI[r.crop]}</span> {r.crop}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      // Signed, so sorting puts the biggest income first and expenses last; activities go to the end.
      sortValue: (r) => (r.type === 'activity' ? null : r.type === 'income' ? r.amount : -r.amount),
      render: (r) => <Amount record={r} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => <RowActions record={r} onEdit={onEdit} onDelete={setPendingDelete} />,
    },
  ];

  const empty = isFiltered ? (
    <EmptyState
      icon={ClipboardList}
      title="No matching records"
      description="Try another tab or crop filter."
    />
  ) : (
    <EmptyState
      icon={ClipboardList}
      title="No records yet. Add your first record!"
      description="Income, expenses and farm activities you record here build your financial history."
      action={
        <Button icon={Plus} onClick={() => openModal('record')}>
          Add your first record
        </Button>
      }
    />
  );

  return (
    <>
      {/* 640px and up: sortable table */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          defaultSort={{ key: 'date', direction: 'desc' }}
          caption="Farm records"
          empty={empty}
        />
      </div>

      {/* Below 640px: one stacked card per record */}
      <div className="sm:hidden">
        {rows.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-3" aria-label="Farm records">
            {rows.map((record) => (
              <li key={record.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-text-mute flex flex-wrap items-center gap-2 text-xs">
                    <Badge color={TYPE_BADGE[record.type].color}>
                      {TYPE_BADGE[record.type].label}
                    </Badge>
                    {formatDate(record.date)}
                  </div>
                  <Amount record={record} />
                </div>
                <div className="mt-2 text-sm">
                  <Description record={record} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-text-dim text-xs">
                    <span aria-hidden="true">{CROP_EMOJI[record.crop]}</span> {record.crop}
                  </span>
                  <RowActions record={record} onEdit={onEdit} onDelete={setPendingDelete} large />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this record?"
        message={
          pendingDelete
            ? `"${pendingDelete.description}" will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
