import type { Season } from '@/entities/episode';
import { episodeNeighbours } from './episode-neighbours';

const SEASONS: Season[] = [
  {
    number: 1,
    episodes: [
      { seasonNumber: 1, number: 1 },
      { seasonNumber: 1, number: 2 },
    ],
  },
  { number: 2, episodes: [{ seasonNumber: 2, number: 1 }] },
];

describe('episodeNeighbours', () => {
  it('steps across the season boundary in both directions', () => {
    expect(episodeNeighbours(SEASONS, { seasonNumber: 1, number: 2 })).toEqual({
      previous: { seasonNumber: 1, number: 1 },
      next: { seasonNumber: 2, number: 1 },
    });
  });

  it('has no previous episode at the start and no next one at the end', () => {
    expect(episodeNeighbours(SEASONS, { seasonNumber: 1, number: 1 }).previous).toBeUndefined();
    expect(episodeNeighbours(SEASONS, { seasonNumber: 2, number: 1 }).next).toBeUndefined();
  });

  it('has no neighbours for an episode that is not in the list', () => {
    expect(episodeNeighbours(SEASONS, { seasonNumber: 9, number: 9 })).toEqual({});
  });
});
