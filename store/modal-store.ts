import { create } from 'zustand';
import type { NewMomoInput, NewRecordInput } from '@/types';

export type GlobalModal = 'record' | 'momo';

interface ModalState {
  modal: GlobalModal | null;
  /** Set when editing an existing record / transaction; undefined when creating. */
  editingId?: string;
  recordDefaults?: Partial<NewRecordInput>;
  /** Prefills a new MoMo transaction, e.g. the direction from "Log money received". */
  momoDefaults?: Partial<NewMomoInput>;
  openModal: (modal: GlobalModal, editingId?: string) => void;
  openRecordWithDefaults: (defaults: Partial<NewRecordInput>) => void;
  openMomoWithDefaults: (defaults: Partial<NewMomoInput>) => void;
  closeModal: () => void;
}

/** Which app-wide form modal is open. The modals are mounted once in app/(main)/layout.tsx. */
export const useModalStore = create<ModalState>()((set) => ({
  modal: null,
  editingId: undefined,
  recordDefaults: undefined,
  momoDefaults: undefined,
  openModal: (modal, editingId) =>
    set({ modal, editingId, recordDefaults: undefined, momoDefaults: undefined }),
  openRecordWithDefaults: (recordDefaults) =>
    set({ modal: 'record', editingId: undefined, recordDefaults, momoDefaults: undefined }),
  openMomoWithDefaults: (momoDefaults) =>
    set({ modal: 'momo', editingId: undefined, recordDefaults: undefined, momoDefaults }),
  closeModal: () =>
    set({ modal: null, editingId: undefined, recordDefaults: undefined, momoDefaults: undefined }),
}));
