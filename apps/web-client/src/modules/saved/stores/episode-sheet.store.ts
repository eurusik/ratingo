/**
 * Episode sheet store.
 * Controls the slide-out episode panel on the Activity page.
 */

import { create } from 'zustand';

import type { MeUserMediaListItemDto } from '@/core/api/me-lists.client';

interface EpisodeSheetState {
  isOpen: boolean;
  item: MeUserMediaListItemDto | null;
  open: (item: MeUserMediaListItemDto) => void;
  close: () => void;
}

export const useEpisodeSheetStore = create<EpisodeSheetState>((set) => ({
  isOpen: false,
  item: null,
  open: (item) => set({ isOpen: true, item }),
  close: () => set({ isOpen: false, item: null }),
}));
