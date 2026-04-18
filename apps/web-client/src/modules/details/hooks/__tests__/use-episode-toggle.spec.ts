import { renderHook, act } from '@testing-library/react';
import { useEpisodeToggle } from '../use-episode-toggle';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { toast } from 'sonner';

const mockMutate = jest.fn();
const mockMultipleMutate = jest.fn();

jest.mock('@/core/query', () => ({
  useToggleEpisodeWatched: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useMarkMultipleWatched: () => ({
    mutate: mockMultipleMutate,
    isPending: false,
  }),
}));

const mockDict = {
  activity: {
    toast: {
      completed: 'Завершено',
      addedToWatching: 'Додано до перегляду',
      backToWatching: 'Повернено до перегляду',
      removedFromActivity: 'Видалено з активності',
    },
  },
} as ReturnType<typeof import('@/shared/i18n').getDictionary>;

const makeEpisode = (id: string, number: number) => ({
  id,
  number,
  title: null,
  airDate: null,
  runtime: null,
  stillPath: null,
});

const defaultParams = () => ({
  showId: 'show-1',
  isAuthenticated: true,
  dict: mockDict,
  episodes: [makeEpisode('e1', 1), makeEpisode('e2', 2), makeEpisode('e3', 3)],
  watchedEpisodeIds: new Set<string>(),
  totalProgress: { watched: 0, total: 3 },
});

describe('useEpisodeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleToggleWatched', () => {
    it('calls mutate with correct params for unwatched episode', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        { episodeId: 'e1', seasonNumber: 1, watched: true },
        expect.any(Object),
      );
    });

    it('calls mutate with watched=false for already watched episode', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1']);
      params.totalProgress = { watched: 1, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        { episodeId: 'e1', seasonNumber: 1, watched: false },
        expect.any(Object),
      );
    });

    it('sets togglingEpisodeId during mutation', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleToggleWatched('e2', 1);
      });

      expect(result.current.togglingEpisodeId).toBe('e2');
    });

    it('sets animatingIds when marking as watched', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(result.current.animatingIds.has('e1')).toBe(true);
    });

    it('does not set animatingIds when unmarking', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1']);
      params.totalProgress = { watched: 1, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(result.current.animatingIds.size).toBe(0);
    });

    it('does not call mutate when not authenticated', () => {
      const params = defaultParams();
      params.isAuthenticated = false;

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows "completed" toast when last episode is marked', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1', 'e2']);
      params.totalProgress = { watched: 2, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e3', 1);
      });

      // Trigger onSuccess
      const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
      act(() => { onSuccess(); });

      expect(toast.success).toHaveBeenCalledWith('Завершено');
    });

    it('shows "addedToWatching" toast when first episode is marked', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
      act(() => { onSuccess(); });

      expect(toast.success).toHaveBeenCalledWith('Додано до перегляду');
    });

    it('shows "backToWatching" toast when unmarking from completed state', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1', 'e2', 'e3']);
      params.totalProgress = { watched: 3, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e3', 1);
      });

      const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
      act(() => { onSuccess(); });

      expect(toast.info).toHaveBeenCalledWith('Повернено до перегляду');
    });

    it('shows "removedFromActivity" toast when last watched episode is unmarked', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1']);
      params.totalProgress = { watched: 1, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
      act(() => { onSuccess(); });

      expect(toast.info).toHaveBeenCalledWith('Видалено з активності');
    });

    it('clears togglingEpisodeId and animatingIds on settled', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleToggleWatched('e1', 1);
      });

      expect(result.current.togglingEpisodeId).toBe('e1');

      const onSettled = mockMutate.mock.calls[0][1].onSettled;
      act(() => { onSettled(); });

      expect(result.current.togglingEpisodeId).toBeNull();

      act(() => { jest.advanceTimersByTime(350); });

      expect(result.current.animatingIds.size).toBe(0);
    });
  });

  describe('handleMarkWithPrevious', () => {
    it('marks all unwatched episodes up to and including the given index', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleMarkWithPrevious(2, 1);
      });

      expect(mockMultipleMutate).toHaveBeenCalledWith(
        { episodeIds: ['e1', 'e2', 'e3'], seasonNumber: 1 },
        expect.any(Object),
      );
    });

    it('skips already watched episodes', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1']);
      params.totalProgress = { watched: 1, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleMarkWithPrevious(2, 1);
      });

      expect(mockMultipleMutate).toHaveBeenCalledWith(
        { episodeIds: ['e2', 'e3'], seasonNumber: 1 },
        expect.any(Object),
      );
    });

    it('does nothing when all episodes up to index are already watched', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1', 'e2']);
      params.totalProgress = { watched: 2, total: 3 };

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleMarkWithPrevious(1, 1);
      });

      expect(mockMultipleMutate).not.toHaveBeenCalled();
    });

    it('sets animatingIds for all episodes being marked', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      act(() => {
        result.current.handleMarkWithPrevious(1, 1);
      });

      expect(result.current.animatingIds.has('e1')).toBe(true);
      expect(result.current.animatingIds.has('e2')).toBe(true);
    });

    it('does not call mutate when not authenticated', () => {
      const params = defaultParams();
      params.isAuthenticated = false;

      const { result } = renderHook(() => useEpisodeToggle(params));

      act(() => {
        result.current.handleMarkWithPrevious(2, 1);
      });

      expect(mockMultipleMutate).not.toHaveBeenCalled();
    });
  });

  describe('getUnwatchedPreviousCount', () => {
    it('returns count of unwatched episodes before given index', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e2']);

      const { result } = renderHook(() => useEpisodeToggle(params));

      // Before index 2: e1 (unwatched), e2 (watched) → 1 unwatched
      expect(result.current.getUnwatchedPreviousCount(2)).toBe(1);
    });

    it('returns 0 for index 0', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      expect(result.current.getUnwatchedPreviousCount(0)).toBe(0);
    });

    it('returns 0 when all previous episodes are watched', () => {
      const params = defaultParams();
      params.watchedEpisodeIds = new Set(['e1', 'e2']);

      const { result } = renderHook(() => useEpisodeToggle(params));

      expect(result.current.getUnwatchedPreviousCount(2)).toBe(0);
    });

    it('counts all unwatched when none are watched', () => {
      const { result } = renderHook(() => useEpisodeToggle(defaultParams()));

      expect(result.current.getUnwatchedPreviousCount(3)).toBe(3);
    });
  });
});
