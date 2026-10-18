'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  generateMomoReference,
  MOMO_NETWORKS,
  momoSchema,
  type MomoFormInput,
  type MomoFormValues,
} from '@/components/momo/momo-schema';
import { Button } from '@/components/ui/button';
import { FormField, fieldErrorId, fieldHintId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { todayISO } from '@/lib/format';
import { useFarmStore } from '@/store/farm-store';
import { useModalStore } from '@/store/modal-store';
import type { MomoTransaction, NewMomoInput } from '@/types';

function toFormValues(transaction?: MomoTransaction): MomoFormInput {
  return transaction
    ? {
        direction: transaction.direction,
        counterparty: transaction.counterparty,
        amount: transaction.amount,
        reference: transaction.reference,
        network: transaction.network ?? 'MTN',
        date: transaction.date,
      }
    : {
        direction: 'in',
        counterparty: '',
        amount: '',
        reference: '',
        network: 'MTN',
        date: todayISO(),
      };
}

/** App-wide add/edit MoMo modal. Open it with useModalStore().openModal('momo', id?). */
export function MomoFormModal() {
  const modal = useModalStore((s) => s.modal);
  const editingId = useModalStore((s) => s.editingId);
  const closeModal = useModalStore((s) => s.closeModal);
  const editing = useFarmStore((s) =>
    editingId ? s.momo.find((t) => t.id === editingId) : undefined,
  );
  const formId = useId();
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={modal === 'momo'}
      onClose={closeModal}
      title={editing ? 'Edit MoMo Transaction' : 'New MoMo Transaction'}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {editing ? 'Update transaction' : 'Save transaction'}
          </Button>
        </>
      }
    >
      <MomoForm
        key={editing?.id ?? 'new'}
        formId={formId}
        editing={editing}
        onDone={closeModal}
        onSavingChange={setSaving}
      />
    </Modal>
  );
}

function MomoForm({
  formId,
  editing,
  onDone,
  onSavingChange,
}: {
  formId: string;
  editing?: MomoTransaction;
  onDone: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const addMomo = useFarmStore((s) => s.addMomo);
  const updateMomo = useFarmStore((s) => s.updateMomo);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MomoFormInput, unknown, MomoFormValues>({
    resolver: zodResolver(momoSchema),
    defaultValues: toFormValues(editing),
  });

  async function onSubmit(values: MomoFormValues) {
    const input: NewMomoInput = {
      direction: values.direction,
      counterparty: values.counterparty,
      amount: values.amount,
      reference: values.reference?.toUpperCase() || generateMomoReference(),
      network: values.network,
      date: values.date,
    };
    onSavingChange(true);
    try {
      if (editing) {
        await updateMomo(editing.id, input);
        toast.success('Transaction updated');
      } else {
        await addMomo(input);
        toast.success('MoMo transaction saved');
      }
      reset();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the transaction');
    } finally {
      onSavingChange(false);
    }
  }

  const describe = (id: string, hasError: boolean, hint?: boolean) =>
    hasError ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined;

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Direction" htmlFor="momo-direction" error={errors.direction?.message}>
        <Select id="momo-direction" error={Boolean(errors.direction)} {...register('direction')}>
          <option value="in">Received (Inflow)</option>
          <option value="out">Sent (Outflow)</option>
        </Select>
      </FormField>

      <FormField
        label="Counterparty"
        htmlFor="momo-counterparty"
        error={errors.counterparty?.message}
      >
        <Input
          id="momo-counterparty"
          placeholder="e.g., Buyer name or vendor"
          error={Boolean(errors.counterparty)}
          aria-describedby={describe('momo-counterparty', Boolean(errors.counterparty))}
          {...register('counterparty')}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Amount (GHS)" htmlFor="momo-amount" error={errors.amount?.message}>
          <Input
            id="momo-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            error={Boolean(errors.amount)}
            aria-describedby={describe('momo-amount', Boolean(errors.amount))}
            {...register('amount')}
          />
        </FormField>

        <FormField label="Network" htmlFor="momo-network" error={errors.network?.message}>
          <Select id="momo-network" error={Boolean(errors.network)} {...register('network')}>
            {MOMO_NETWORKS.map((network) => (
              <option key={network} value={network}>
                {network}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Reference"
          htmlFor="momo-reference"
          hint="Leave blank to generate one"
          error={errors.reference?.message}
        >
          <Input
            id="momo-reference"
            placeholder="Transaction ID"
            autoCapitalize="characters"
            className="font-mono"
            error={Boolean(errors.reference)}
            aria-describedby={describe('momo-reference', Boolean(errors.reference), true)}
            {...register('reference')}
          />
        </FormField>

        <FormField label="Date" htmlFor="momo-date" error={errors.date?.message}>
          <Input
            id="momo-date"
            type="date"
            max={todayISO()}
            error={Boolean(errors.date)}
            aria-describedby={describe('momo-date', Boolean(errors.date))}
            {...register('date')}
          />
        </FormField>
      </div>
    </form>
  );
}
