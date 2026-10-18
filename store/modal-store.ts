import { create } from 'zustand';
import type { NewRecordInput } from '@/types';

export type GlobalModal = 'record' | 'momo';

interface ModalState {
  modal: GlobalModal | null;
  /** Set when editing an existing record / transaction; undefined when creating. */
  editingId?: string;
  recordDefaults?: Partial<NewRecordInput>;
  openModal: (modal: GlobalModal, editingId?: string) => void;
  openRecordWithDefaults: (defaults: Partial<NewRecordInput>) => void;
  closeModal: () => void;
}

/** Which app-wide form modal is open. The modals are mounted once in app/(main)/layout.tsx. */
export const useModalStore = create<ModalState>()((set) => ({
  modal: null,
  editingId: undefined,
  recordDefaults: undefined,
  openModal: (modal, editingId) => set({ modal, editingId, recordDefaults: undefined }),
  openRecordWithDefaults: (recordDefaults) =>
    set({ modal: 'record', editingId: undefined, recordDefaults }),
  closeModal: () => set({ modal: null, editingId: undefined, recordDefaults: undefined }),
}));
