import { create } from 'zustand';

export type GlobalModal = 'record' | 'momo';

interface ModalState {
  modal: GlobalModal | null;
  /** Set when editing an existing record / transaction; undefined when creating. */
  editingId?: string;
  openModal: (modal: GlobalModal, editingId?: string) => void;
  closeModal: () => void;
}

/** Which app-wide form modal is open. The modals are mounted once in app/(main)/layout.tsx. */
export const useModalStore = create<ModalState>()((set) => ({
  modal: null,
  editingId: undefined,
  openModal: (modal, editingId) => set({ modal, editingId }),
  closeModal: () => set({ modal: null, editingId: undefined }),
}));
