'use client';

import { useState } from 'react';
import { Pencil, Plus, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFarmStore } from '@/store/farm-store';
import { useModalStore } from '@/store/modal-store';
import type { MomoNetwork, MomoTransaction } from '@/types';

const NETWORK_BADGE: Record<MomoNetwork, BadgeColor> = {
  MTN: 'gold',
  Telecel: 'red',
  AirtelTigo: 'blue',
};

function DirectionBadge({ t }: { t: MomoTransaction }) {
  return t.direction === 'in' ? (
    <Badge color="green">Received</Badge>
  ) : (
    <Badge color="red">Sent</Badge>
  );
}

function NetworkBadge({ t }: { t: MomoTransaction }) {
  if (!t.network) return <span className="text-text-mute">—</span>;
  return (
    <Badge color={NETWORK_BADGE[t.network]} className="text-[10px]">
      {t.network}
    </Badge>
  );
}

function Amount({ t }: { t: MomoTransaction }) {
  const inflow = t.direction === 'in';
  return (
    <span
      className={cn('font-semibold whitespace-nowrap', inflow ? 'text-ink-green' : 'text-ink-red')}
    >
      {inflow ? '+' : '−'}
      {formatGHS(t.amount)}
    </span>
  );
}

function Reference({ t }: { t: MomoTransaction }) {
  return <span className="text-text-dim font-mono text-[11px] break-all">{t.reference}</span>;
}

function RowActions({
  t,
  onEdit,
  onDelete,
  large = false,
}: {
  t: MomoTransaction;
  onEdit: (t: MomoTransaction) => void;
  onDelete: (t: MomoTransaction) => void;
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
        onClick={() => onEdit(t)}
        aria-label={`Edit transaction with ${t.counterparty}`}
        className={cn(buttonClass, 'hover:text-text')}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(t)}
        aria-label={`Delete transaction with ${t.counterparty}`}
        className={cn(buttonClass, 'hover:text-ink-red')}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function MomoTable({ rows, isFiltered }: { rows: MomoTransaction[]; isFiltered: boolean }) {
  const openModal = useModalStore((s) => s.openModal);
  const deleteMomo = useFarmStore((s) => s.deleteMomo);
  const [pendingDelete, setPendingDelete] = useState<MomoTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onEdit = (t: MomoTransaction) => openModal('momo', t.id);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteMomo(pendingDelete.id);
      toast.success('Transaction deleted');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the transaction');
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<MomoTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (t) => t.date,
      render: (t) => <span className="whitespace-nowrap">{formatDate(t.date)}</span>,
    },
    { key: 'direction', header: 'Type', render: (t) => <DirectionBadge t={t} /> },
    {
      key: 'counterparty',
      header: 'Counterparty',
      className: 'max-w-xs',
      render: (t) => <span className="text-text break-words">{t.counterparty}</span>,
    },
    { key: 'network', header: 'Network', render: (t) => <NetworkBadge t={t} /> },
    { key: 'reference', header: 'Reference', render: (t) => <Reference t={t} /> },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      sortValue: (t) => (t.direction === 'in' ? t.amount : -t.amount),
      render: (t) => <Amount t={t} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t) => <RowActions t={t} onEdit={onEdit} onDelete={setPendingDelete} />,
    },
  ];

  const empty = isFiltered ? (
    <EmptyState
      icon={Smartphone}
      title="No matching transactions"
      description="Try another filter."
    />
  ) : (
    <EmptyState
      icon={Smartphone}
      title="No MoMo transactions yet"
      description="Log mobile money payments you send and receive. They raise your credit score."
      action={
        <Button icon={Plus} onClick={() => openModal('momo')}>
          Add your first transaction
        </Button>
      }
    />
  );

  return (
    <>
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(t) => t.id}
          defaultSort={{ key: 'date', direction: 'desc' }}
          caption="MoMo transactions"
          empty={empty}
        />
      </div>

      <div className="sm:hidden">
        {rows.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-3" aria-label="MoMo transactions">
            {rows.map((t) => (
              <li key={t.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-text-mute flex flex-wrap items-center gap-2 text-xs">
                    <DirectionBadge t={t} />
                    <NetworkBadge t={t} />
                    {formatDate(t.date)}
                  </div>
                  <Amount t={t} />
                </div>
                <p className="text-text mt-2 text-sm break-words">{t.counterparty}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <Reference t={t} />
                  <RowActions t={t} onEdit={onEdit} onDelete={setPendingDelete} large />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this transaction?"
        message={
          pendingDelete
            ? `The ${formatGHS(pendingDelete.amount)} transaction with "${pendingDelete.counterparty}" will be permanently removed. This cannot be undone.`
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
