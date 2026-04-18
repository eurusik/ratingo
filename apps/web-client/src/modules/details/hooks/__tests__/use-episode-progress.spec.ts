import { renderHook } from '@testing-library/react';
import { useEpisodeProgress } from '../use-episode-progress';

const mockUseShowProgress = jest.fn();
jest.mock('@/core/query', () => ({
  useShowProgress: (...args: unknown[]) => mockUseShowProgress(...args),
}));

const makeSeason = (
  number: number,
  episodes: { id?: string; number: number; airDate: string | null }[],
) => ({
  number,
  name: null,
  episodeCount: episodes.length,
  posterPath: null,
  airDate: null,
  episodes: episodes.map((e) => ({
    ...e,
    title: null,
    runtime: null,
    stillPath: null,
  })),
});

const makeProgressSeason = (
  seasonNumber: number,
  watchedEpisodeIds: string[],
  totalCount: number,
) => ({
  seasonNumber,
  watchedEpisodeIds,
  watchedCount: watchedEpisodeIds.length,
  totalCount,
});

describe('useEpisodeProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseShowProgress.mockReturnValue({ data: null });
  });

  it('returns empty defaults when no progress data', () => {
    const seasons = [makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }])];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.progressData).toBeNull();
    expect(result.current.currentSeasonProgress).toBeNull();
    expect(result.current.watchedEpisodeIds.size).toBe(0);
    expect(result.current.totalProgress).toEqual({ watched: 0, total: 0 });
  });

  it('finds currentSeasonProgress for the selected season', () => {
    mockUseShowProgress.mockReturnValue({
      data: {
        seasons: [
          makeProgressSeason(1, ['e1', 'e2'], 5),
          makeProgressSeason(2, ['e10'], 8),
        ],
      },
    });

    const seasons = [
      makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }]),
      makeSeason(2, [{ id: 'e10', number: 1, airDate: '2024-06-01' }]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 2),
    );

    expect(result.current.currentSeasonProgress?.seasonNumber).toBe(2);
    expect(result.current.currentSeasonProgress?.watchedCount).toBe(1);
  });

  it('returns null currentSeasonProgress when selected season has no progress', () => {
    mockUseShowProgress.mockReturnValue({
      data: { seasons: [makeProgressSeason(1, ['e1'], 5)] },
    });

    const seasons = [
      makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }]),
      makeSeason(2, [{ id: 'e10', number: 1, airDate: '2024-06-01' }]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 2),
    );

    expect(result.current.currentSeasonProgress).toBeNull();
  });

  it('builds watchedEpisodeIds Set from current season progress', () => {
    mockUseShowProgress.mockReturnValue({
      data: { seasons: [makeProgressSeason(1, ['e1', 'e3'], 5)] },
    });

    const seasons = [makeSeason(1, [
      { id: 'e1', number: 1, airDate: '2024-01-01' },
      { id: 'e2', number: 2, airDate: '2024-01-08' },
      { id: 'e3', number: 3, airDate: '2024-01-15' },
    ])];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.watchedEpisodeIds.has('e1')).toBe(true);
    expect(result.current.watchedEpisodeIds.has('e2')).toBe(false);
    expect(result.current.watchedEpisodeIds.has('e3')).toBe(true);
  });

  it('calculates totalProgress across all seasons', () => {
    mockUseShowProgress.mockReturnValue({
      data: {
        seasons: [
          makeProgressSeason(1, ['e1', 'e2'], 5),
          makeProgressSeason(2, ['e10'], 8),
        ],
      },
    });

    const seasons = [
      makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }]),
      makeSeason(2, [{ id: 'e10', number: 1, airDate: '2024-06-01' }]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.totalProgress).toEqual({ watched: 3, total: 13 });
  });

  it('groups aired episode IDs by season number, excluding future episodes', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const seasons = [
      makeSeason(1, [
        { id: 'e1', number: 1, airDate: '2024-01-01' },
        { id: 'e2', number: 2, airDate: '2024-01-08' },
      ]),
      makeSeason(2, [
        { id: 'e10', number: 1, airDate: '2024-06-01' },
        { id: 'e11', number: 2, airDate: futureDate.toISOString() },
      ]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.allEpisodesBySeasonNumber.get(1)).toEqual(['e1', 'e2']);
    expect(result.current.allEpisodesBySeasonNumber.get(2)).toEqual(['e10']);
    expect(result.current.totalEpisodesCount).toBe(3);
    expect(result.current.totalAllEpisodes).toBe(4);
  });

  it('tracks lastAiredEpisodeInfo across all seasons', () => {
    const seasons = [
      makeSeason(1, [
        { id: 'e1', number: 1, airDate: '2024-01-01' },
        { id: 'e2', number: 2, airDate: '2024-01-08' },
      ]),
      makeSeason(2, [
        { id: 'e10', number: 1, airDate: '2024-06-01' },
        { id: 'e11', number: 2, airDate: '2024-06-08' },
      ]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.lastAiredEpisodeInfo).toEqual({ season: 2, episode: 2 });
  });

  it('skips seasons with no aired episodes in allEpisodesBySeasonNumber', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const seasons = [
      makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }]),
      makeSeason(2, [{ id: 'e10', number: 1, airDate: futureDate.toISOString() }]),
    ];

    const { result } = renderHook(() =>
      useEpisodeProgress('show-1', true, seasons, 1),
    );

    expect(result.current.allEpisodesBySeasonNumber.has(1)).toBe(true);
    expect(result.current.allEpisodesBySeasonNumber.has(2)).toBe(false);
  });

  it('passes showId and enabled to useShowProgress', () => {
    const seasons = [makeSeason(1, [{ id: 'e1', number: 1, airDate: '2024-01-01' }])];

    renderHook(() => useEpisodeProgress('show-42', false, seasons, 1));

    expect(mockUseShowProgress).toHaveBeenCalledWith('show-42', { enabled: false });
  });
});
