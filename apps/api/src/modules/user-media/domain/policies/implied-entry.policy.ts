import { type UserMediaState } from '../entities/user-media-state.entity';

interface StateChoice {
  state?: UserMediaState['state'];
  stateImplied?: boolean;
}

export function stateImpliedFor(
  choice: StateChoice,
  existing: UserMediaState | null,
): boolean | undefined {
  const isUserChoice = choice.state !== undefined && choice.stateImplied !== true;
  if (isUserChoice) return false;
  return existing ? undefined : true;
}

export function hasUserAuthoredData(entry: Pick<UserMediaState, 'rating' | 'notes'>): boolean {
  return entry.rating != null || (entry.notes != null && entry.notes.trim() !== '');
}

export function isDisposableImpliedEntry(entry: UserMediaState, watchedEpisodes: number): boolean {
  return (
    entry.stateImplied &&
    watchedEpisodes === 0 &&
    entry.progress == null &&
    !hasUserAuthoredData(entry)
  );
}
