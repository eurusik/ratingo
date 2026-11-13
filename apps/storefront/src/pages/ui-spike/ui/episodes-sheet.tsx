'use client';

import { BottomSheet } from './bottom-sheet';
import { EpisodeList } from './episode-list';

export function EpisodesSheet() {
  return (
    <BottomSheet label="Список епізодів" title="Епізоди">
      <EpisodeList />
    </BottomSheet>
  );
}
