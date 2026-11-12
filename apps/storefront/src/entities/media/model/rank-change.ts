export type RankChange =
  | { kind: 'new' }
  | { kind: 'up'; places: number }
  | { kind: 'down'; places: number }
  | { kind: 'same' };

export function rankChange(rank: number, previousRank: number | null | undefined): RankChange {
  if (previousRank == null) return { kind: 'new' };
  if (previousRank > rank) return { kind: 'up', places: previousRank - rank };
  if (previousRank < rank) return { kind: 'down', places: rank - previousRank };
  return { kind: 'same' };
}
