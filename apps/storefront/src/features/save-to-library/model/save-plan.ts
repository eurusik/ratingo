import { isSaved } from '@/entities/library';
import type { MediaSaveStatus, SaveList } from '@/shared/api';

interface ListChange {
  list: SaveList;
  action: 'save' | 'unsave';
}

const LIST_FLAGS: Record<SaveList, keyof MediaSaveStatus> = {
  for_later: 'isForLater',
  considering: 'isConsidering',
};

export function ensureSaved(current: MediaSaveStatus): MediaSaveStatus {
  return isSaved(current) ? current : { ...current, isForLater: true };
}

export function planListChanges(from: MediaSaveStatus, to: MediaSaveStatus): ListChange[] {
  return (Object.keys(LIST_FLAGS) as SaveList[]).flatMap((list): ListChange[] => {
    const flag = LIST_FLAGS[list];
    if (from[flag] === to[flag]) return [];
    return [{ list, action: to[flag] ? 'save' : 'unsave' }];
  });
}
