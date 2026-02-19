/**
 * Global search dialog store.
 * Allows any component (header search, mobile dock) to open/close the search dialog.
 */

import { create } from 'zustand';

interface SearchDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const useSearchDialogStore = create<SearchDialogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen: boolean) => set({ isOpen }),
}));
