import { renderHook, act } from '@testing-library/react';
import { useCatchUp } from '../use-catch-up';
import type { EpisodeProgressData } from '../use-episode-progress';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    dismiss: jest.fn(),
  },
}));

import { toast } from 'sonner';

const mockMarkAllMutateAsync = jest.fn();
const mockUnmarkMutate = jest.fn();
const mockUnmarkMutateAsync = jest.fn();
const mockResetMutate = jest.fn();

jest.mock('@/core/query', () => ({
  useMarkAllEpisodesWatched: () => ({
    mutateAsync: mockMarkAllMutateAsync,
    isPending: false,
  }),
  useUnmarkEpisodes: () => ({
    mutate: mockUnmarkMutate,
    mutateAsync: mockUnmarkMutateAsync,
    isPending: false,
  }),
  useResetSeason: () => ({
    mutate: mockResetMutate,
    isPending: false,
  }),
}));

const mockDict = {
  details: {
    showStatus: {
      caughtUpAll: 'Все переглянуто!',
      caughtUp: 'Наздогнав до S{season}E{episode}',
      undo: 'Скасувати',
      undone: 'Скасовано',
      seasonReset: 'Сезон скинуто',
      resetSeason: 'Скинути сезон',
      resetSeasonConfirm: 'Скинути {season}?',
      season: 'Сезон',
    },
  },
  common: { error: 'Помилка' },
} as ReturnType<typeof import('@/shared/i18n').getDictionary>;

const makeSeason = (number: number, episodeIds: string[]) => ({
  number,
  name: null,
  episodeCount: episodeIds.length,
  posterPath: null,
  airDate: null,
  episodes: episodeIds.map((id, i) => ({
    id,
    number: i + 1,
    title: null,
    airDate: '2024-01-01',
    runtime: null,
    stillPath: null,
  })),
});

const makeProgress = (
  seasons: { seasonNumber: number; watchedEpisodeIds: string[]; totalCount: number }[],
): EpisodeProgressData => ({
  progressData: {
    showId: 'show-1',
    seasons: seasons.map((s) => ({
      ...s,
      watchedCount: s.watchedEpisodeIds.length,
    })),
  },
  currentSeasonProgress: seasons[0]
    ? {
        seasonNumber: seasons[0].seasonNumber,
        watchedEpisodeIds: seasons[0].watchedEpisodeIds,
        watchedCount: seasons[0].watchedEpisodeIds.length,
        totalCount: seasons[0].totalCount,
      }
    : null,
  watchedEpisodeIds: new Set(seasons.flatMap((s) => s.watchedEpisodeIds)),
  totalProgress: seasons.reduce(
    (acc, s) => ({
      watched: acc.watched + s.watchedEpisodeIds.length,
      total: acc.total + s.totalCount,
    }),
    { watched: 0, total: 0 },
  ),
  allEpisodesBySeasonNumber: new Map(
    seasons.map((s) => {
      const ids = Array.from({ length: s.totalCount }, (_, i) => `e${s.seasonNumber}-${i + 1}`);
      return [s.seasonNumber, ids];
    }),
  ),
  totalEpisodesCount: seasons.reduce((sum, s) => sum + s.totalCount, 0),
  totalAllEpisodes: seasons.reduce((sum, s) => sum + s.totalCount, 0),
  lastAiredEpisodeInfo: { season: 1, episode: 1 },
});

const defaultParams = () => ({
  showId: 'show-1',
  dict: mockDict,
  validSeasons: [makeSeason(1, ['e1-1', 'e1-2', 'e1-3'])],
  progress: makeProgress([
    { seasonNumber: 1, watchedEpisodeIds: [], totalCount: 3 },
  ]),
  selectedSeason: makeSeason(1, ['e1-1', 'e1-2', 'e1-3']),
});

describe('useCatchUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkAllMutateAsync.mockResolvedValue(undefined);
    mockUnmarkMutateAsync.mockResolvedValue(undefined);
  });

  describe('handleMarkAllClick', () => {
    it('directly confirms catch-up for single-season shows', () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      act(() => {
        result.current.handleMarkAllClick();
      });

      // Should call mutateAsync directly (no dialog)
      expect(result.current.showConfirmDialog).toBe(false);
      expect(mockMarkAllMutateAsync).toHaveBeenCalled();
    });

    it('opens confirm dialog for multi-season shows', () => {
      const params = defaultParams();
      params.validSeasons = [
        makeSeason(1, ['e1-1']),
        makeSeason(2, ['e2-1']),
      ];

      const { result } = renderHook(() => useCatchUp(params));

      act(() => {
        result.current.handleMarkAllClick();
      });

      expect(result.current.showConfirmDialog).toBe(true);
      expect(mockMarkAllMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('handleCatchUpConfirm', () => {
    it('calls markAllWatched.mutateAsync with episodes to mark', async () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      const toMark = new Map([[1, ['e1-1', 'e1-2', 'e1-3']]]);

      await act(async () => {
        await result.current.handleCatchUpConfirm(toMark, new Map());
      });

      expect(mockMarkAllMutateAsync).toHaveBeenCalledWith({
        episodesBySeasonNumber: toMark,
      });
    });

    it('shows full catch-up toast when all episodes are marked', async () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      const toMark = new Map([[1, ['e1-1', 'e1-2', 'e1-3']]]);

      await act(async () => {
        await result.current.handleCatchUpConfirm(toMark, new Map());
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Все переглянуто!',
        expect.objectContaining({ action: expect.any(Object), duration: 8000 }),
      );
    });

    it('calls unmarkEpisodes.mutateAsync when toUnmark is provided', async () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      const toUnmark = new Map([[1, ['e1-3']]]);

      await act(async () => {
        await result.current.handleCatchUpConfirm(new Map(), toUnmark);
      });

      expect(mockUnmarkMutateAsync).toHaveBeenCalledWith(['e1-3']);
    });

    it('shows seasonReset toast when only unmarking', async () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      await act(async () => {
        await result.current.handleCatchUpConfirm(new Map(), new Map([[1, ['e1-3']]]));
      });

      expect(toast.success).toHaveBeenCalledWith('Сезон скинуто');
    });

    it('shows error toast when mutation fails', async () => {
      mockMarkAllMutateAsync.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useCatchUp(defaultParams()));

      await act(async () => {
        await result.current.handleCatchUpConfirm(
          new Map([[1, ['e1-1']]]),
          new Map(),
        );
      });

      expect(toast.error).toHaveBeenCalledWith('Помилка');
    });

    it('closes confirm dialog', async () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      act(() => {
        result.current.setShowConfirmDialog(true);
      });
      expect(result.current.showConfirmDialog).toBe(true);

      await act(async () => {
        await result.current.handleCatchUpConfirm(new Map(), new Map());
      });

      expect(result.current.showConfirmDialog).toBe(false);
    });
  });

  describe('handleResetSeasonClick', () => {
    it('opens reset confirm dialog', () => {
      const params = defaultParams();
      params.progress = makeProgress([
        { seasonNumber: 1, watchedEpisodeIds: ['e1-1', 'e1-2'], totalCount: 3 },
      ]);

      const { result } = renderHook(() => useCatchUp(params));

      act(() => {
        result.current.handleResetSeasonClick();
      });

      expect(result.current.showResetConfirmDialog).toBe(true);
    });
  });

  describe('handleConfirmResetSeason', () => {
    it('calls resetSeason.mutate with snapshotted episode IDs and season number', () => {
      const params = defaultParams();
      params.progress = makeProgress([
        { seasonNumber: 1, watchedEpisodeIds: ['e1-1', 'e1-2'], totalCount: 3 },
      ]);

      const { result } = renderHook(() => useCatchUp(params));

      // First open the dialog to snapshot state
      act(() => {
        result.current.handleResetSeasonClick();
      });

      // Then confirm
      act(() => {
        result.current.handleConfirmResetSeason();
      });

      expect(mockResetMutate).toHaveBeenCalledWith(
        { episodeIds: ['e1-1', 'e1-2'], seasonNumber: 1 },
        expect.any(Object),
      );
    });

    it('closes reset confirm dialog', () => {
      const params = defaultParams();
      params.progress = makeProgress([
        { seasonNumber: 1, watchedEpisodeIds: ['e1-1'], totalCount: 3 },
      ]);

      const { result } = renderHook(() => useCatchUp(params));

      act(() => { result.current.handleResetSeasonClick(); });
      expect(result.current.showResetConfirmDialog).toBe(true);

      act(() => { result.current.handleConfirmResetSeason(); });
      expect(result.current.showResetConfirmDialog).toBe(false);
    });

    it('does nothing when no episode IDs were snapshotted', () => {
      const { result } = renderHook(() => useCatchUp(defaultParams()));

      // Confirm without opening the dialog first (no snapshot)
      act(() => {
        result.current.handleConfirmResetSeason();
      });

      expect(mockResetMutate).not.toHaveBeenCalled();
    });

    it('shows success toast on reset', () => {
      const params = defaultParams();
      params.progress = makeProgress([
        { seasonNumber: 1, watchedEpisodeIds: ['e1-1'], totalCount: 3 },
      ]);

      const { result } = renderHook(() => useCatchUp(params));

      act(() => { result.current.handleResetSeasonClick(); });
      act(() => { result.current.handleConfirmResetSeason(); });

      const onSuccess = mockResetMutate.mock.calls[0][1].onSuccess;
      act(() => { onSuccess(); });

      expect(toast.success).toHaveBeenCalledWith('Сезон скинуто');
    });

    it('shows error toast on reset failure', () => {
      const params = defaultParams();
      params.progress = makeProgress([
        { seasonNumber: 1, watchedEpisodeIds: ['e1-1'], totalCount: 3 },
      ]);

      const { result } = renderHook(() => useCatchUp(params));

      act(() => { result.current.handleResetSeasonClick(); });
      act(() => { result.current.handleConfirmResetSeason(); });

      const onError = mockResetMutate.mock.calls[0][1].onError;
      act(() => { onError(); });

      expect(toast.error).toHaveBeenCalledWith('Помилка');
    });
  });
});
