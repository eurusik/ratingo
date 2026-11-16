import { renderHook } from '@testing-library/react';
import { rememberTrackingState, toSeasons } from '@/entities/episode';
import type { EpisodesTracker } from '@/widgets/episodes-sheet';
import { useRememberTracking } from './use-remember-tracking';

jest.mock('@/entities/episode', () => ({
  ...jest.requireActual<object>('@/entities/episode'),
  rememberTrackingState: jest.fn(),
}));

const NOW = Date.parse('2026-11-15T12:00:00Z');
const seasons = toSeasons([
  {
    number: 1,
    name: 'Season 1',
    episodeCount: 2,
    airDate: '2026-11-01',
    episodes: [
      { id: 'e1', number: 1, title: 'One', airDate: '2026-11-01T12:00:00Z' },
      { id: 'e2', number: 2, title: 'Two', airDate: '2026-11-20T12:00:00Z' },
    ],
  },
] as never);

function trackerWith(partial: Partial<EpisodesTracker>): EpisodesTracker {
  return {
    now: NOW,
    canTrack: true,
    isResolving: false,
    summary: { watched: 1 },
    ...partial,
  } as EpisodesTracker;
}

describe('useRememberTracking', () => {
  afterEach(() => jest.clearAllMocks());

  it('remembers the state once the progress is known', () => {
    renderHook(() => useRememberTracking('simpsons', seasons, trackerWith({})));
    expect(rememberTrackingState).toHaveBeenCalledWith('simpsons', 'watching-next');
  });

  it('waits while the progress loads and for the client clock', () => {
    renderHook(() => useRememberTracking('simpsons', seasons, trackerWith({ isResolving: true })));
    renderHook(() =>
      useRememberTracking('simpsons', seasons, trackerWith({ now: Number.POSITIVE_INFINITY })),
    );
    expect(rememberTrackingState).not.toHaveBeenCalled();
  });
});
