import type { MediaImportResult, UserMediaState } from '@/shared/api';
import { pickRatedShows, ratedImportIds } from './rated-shows';

const RESULT: MediaImportResult = {
  imported: 3,
  skipped: 0,
  notFound: 0,
  durationMs: 1,
  details: {
    imported: [
      { mediaItemId: 'rated-show', state: 'completed', rating: 90, title: 'Show' },
      { mediaItemId: 'unrated', state: 'completed', rating: null, title: 'Seen' },
      { mediaItemId: 'planned', state: 'planned', rating: null, title: 'Later' },
    ],
    skipped: [],
    notFound: [],
  },
};

function entry(mediaItemId: string, type: 'movie' | 'show'): UserMediaState {
  return {
    id: `state-${mediaItemId}`,
    userId: 'u1',
    mediaItemId,
    state: 'completed',
    rating: 90,
    progress: null,
    notes: null,
    stateImplied: false,
    createdAt: '',
    updatedAt: '',
    mediaSummary: { id: mediaItemId, type, title: mediaItemId, slug: mediaItemId, poster: null },
  };
}

describe('rated imported shows', () => {
  it('keeps only titles imported with a rating', () => {
    expect(ratedImportIds(RESULT)).toEqual(['rated-show']);
  });

  it('picks shows from history that were imported with a rating', () => {
    const shows = pickRatedShows(
      [
        entry('rated-show', 'show'),
        entry('other-show', 'show'),
        entry('rated-show-movie', 'movie'),
      ],
      new Set(['rated-show', 'rated-show-movie']),
    );
    expect(shows).toEqual([
      {
        mediaItemId: 'rated-show',
        title: 'rated-show',
        slug: 'rated-show',
        imageUrl: undefined,
        score: 9,
      },
    ]);
  });
});
