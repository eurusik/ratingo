import { NOT_SAVED, isSaved } from '@/entities/library';
import type { MediaSaveStatus, SaveList } from '@/shared/api';

export interface ListChange {
  list: SaveList;
  action: 'save' | 'unsave';
}

const LIST_FLAGS: Record<SaveList, keyof MediaSaveStatus> = {
  for_later: 'isForLater',
  considering: 'isConsidering',
};

export function toggledStatus(current: MediaSaveStatus): MediaSaveStatus {
  return isSaved(current) ? NOT_SAVED : { ...current, isForLater: true };
}

export function planListChanges(from: MediaSaveStatus, to: MediaSaveStatus): ListChange[] {
  return (Object.keys(LIST_FLAGS) as SaveList[]).flatMap((list): ListChange[] => {
    const flag = LIST_FLAGS[list];
    if (from[flag] === to[flag]) return [];
    return [{ list, action: to[flag] ? 'save' : 'unsave' }];
  });
}

export function applyListChanges(status: MediaSaveStatus, changes: ListChange[]): MediaSaveStatus {
  return changes.reduce(
    (next, { list, action }) => ({ ...next, [LIST_FLAGS[list]]: action === 'save' }),
    status,
  );
}
