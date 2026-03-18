import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

import {
  useShowProgress,
  useToggleEpisodeWatched,
  useMarkMultipleWatched,
  useMarkAllEpisodesWatched,
  useUnmarkEpisodes,
  useResetSeason,
} from '../episode-progress';
import { queryKeys } from '../keys';

jest.mock('@/core/api/episode-progress.client', () => ({
  episodeProgressApi: {
    getShowProgress: jest.fn(),
    markWatched: jest.fn(),
    markUnwatched: jest.fn(),
    markBatchWatched: jest.fn(),
    markBatchUnwatched: jest.fn(),
  },
}));

import { episodeProgressApi } from '@/core/api/episode-progress.client';
import type { ShowProgressDto, SeasonProgressDto } from '@/core/api/episode-progress.client';

const mockGetShowProgress = episodeProgressApi.getShowProgress as jest.Mock;
const mockMarkWatched = episodeProgressApi.markWatched as jest.Mock;
const mockMarkUnwatched = episodeProgressApi.markUnwatched as jest.Mock;
const mockMarkBatchWatched = episodeProgressApi.markBatchWatched as jest.Mock;
const mockMarkBatchUnwatched = episodeProgressApi.markBatchUnwatched as jest.Mock;

const SHOW_ID = 'show-1';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function buildProgress(seasons: SeasonProgressDto[]): ShowProgressDto {
  return { showId: SHOW_ID, seasons };
}

function buildSeason(
  seasonNumber: number,
  totalCount: number,
  watchedEpisodeIds: string[],
): SeasonProgressDto {
  return {
    seasonNumber,
    totalCount,
    watchedCount: watchedEpisodeIds.length,
    watchedEpisodeIds,
  };
}

// ============================================================================
// useShowProgress
// ============================================================================

function ShowProgressConsumer({ showId }: { showId?: string }) {
  const query = useShowProgress(showId);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

describe('useShowProgress', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches show progress when showId is provided', async () => {
    const mockData = buildProgress([buildSeason(1, 8, ['ep-1', 'ep-2'])]);
    mockGetShowProgress.mockResolvedValue(mockData);

    renderWithClient(<ShowProgressConsumer showId={SHOW_ID} />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetShowProgress).toHaveBeenCalledWith(SHOW_ID);
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(mockData));
  });

  it('does not fetch when showId is undefined', async () => {
    renderWithClient(<ShowProgressConsumer showId={undefined} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetShowProgress).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

// ============================================================================
// useToggleEpisodeWatched
// ============================================================================

function ToggleEpisodeConsumer() {
  const mutation = useToggleEpisodeWatched(SHOW_ID);
  const watchedCount = mutation.variables?.watched;

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <span data-testid="watched-flag">{String(watchedCount ?? 'none')}</span>
      <button
        data-testid="mark-watched"
        onClick={() =>
          mutation.mutate({ episodeId: 'ep-3', seasonNumber: 1, watched: true })
        }
      />
      <button
        data-testid="mark-unwatched"
        onClick={() =>
          mutation.mutate({ episodeId: 'ep-1', seasonNumber: 1, watched: false })
        }
      />
    </div>
  );
}

describe('useToggleEpisodeWatched', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls markWatched API when watched is true', async () => {
    mockMarkWatched.mockResolvedValue(undefined);

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-watched').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkWatched).toHaveBeenCalledWith('ep-3');
    expect(mockMarkUnwatched).not.toHaveBeenCalled();
  });

  it('calls markUnwatched API when watched is false', async () => {
    mockMarkUnwatched.mockResolvedValue(undefined);

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-unwatched').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkUnwatched).toHaveBeenCalledWith('ep-1');
    expect(mockMarkWatched).not.toHaveBeenCalled();
  });

  it('optimistically adds episode to watchedEpisodeIds when marking watched', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2']),
      buildSeason(2, 6, []),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-watched').click();
    });

    // Check optimistic cache update
    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(optimistic!.seasons[0].watchedEpisodeIds).toContain('ep-3');
    expect(optimistic!.seasons[0].watchedCount).toBe(3);
    // Season 2 should remain unchanged
    expect(optimistic!.seasons[1].watchedEpisodeIds).toEqual([]);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('optimistically removes episode from watchedEpisodeIds when marking unwatched', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2', 'ep-3']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkUnwatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-unwatched').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(optimistic!.seasons[0].watchedEpisodeIds).toEqual(['ep-2', 'ep-3']);
    expect(optimistic!.seasons[0].watchedCount).toBe(2);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('rolls back optimistic update on error', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    mockMarkWatched.mockRejectedValue(new Error('server error'));

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-watched').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    const rolledBack = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(rolledBack!.seasons[0].watchedEpisodeIds).toEqual(['ep-1', 'ep-2']);
    expect(rolledBack!.seasons[0].watchedCount).toBe(2);
  });

  it('invalidates all related caches on settled', async () => {
    mockMarkWatched.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-watched').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userMedia.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.meLists.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userActions.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.savedItems.all }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not modify other seasons during optimistic update', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1']),
      buildSeason(2, 6, ['ep-20', 'ep-21']),
      buildSeason(3, 10, []),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<ToggleEpisodeConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-watched').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    // Season 2 and 3 remain unchanged
    expect(optimistic!.seasons[1].watchedEpisodeIds).toEqual(['ep-20', 'ep-21']);
    expect(optimistic!.seasons[2].watchedEpisodeIds).toEqual([]);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });
});

// ============================================================================
// useMarkMultipleWatched
// ============================================================================

function MarkMultipleConsumer() {
  const mutation = useMarkMultipleWatched(SHOW_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="mark-multiple"
        onClick={() =>
          mutation.mutate({
            episodeIds: ['ep-3', 'ep-4', 'ep-5'],
            seasonNumber: 1,
          })
        }
      />
    </div>
  );
}

describe('useMarkMultipleWatched', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls markBatchWatched API with correct episode IDs', async () => {
    mockMarkBatchWatched.mockResolvedValue(undefined);

    renderWithClient(<MarkMultipleConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-multiple').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkBatchWatched).toHaveBeenCalledWith(['ep-3', 'ep-4', 'ep-5']);
  });

  it('optimistically merges episodes into watchedEpisodeIds without duplicates', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-3']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<MarkMultipleConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-multiple').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    // ep-3 was already watched, should not be duplicated
    const watchedIds = optimistic!.seasons[0].watchedEpisodeIds;
    expect(watchedIds).toContain('ep-1');
    expect(watchedIds).toContain('ep-3');
    expect(watchedIds).toContain('ep-4');
    expect(watchedIds).toContain('ep-5');
    expect(watchedIds.filter((id) => id === 'ep-3')).toHaveLength(1);
    expect(optimistic!.seasons[0].watchedCount).toBe(4);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('rolls back optimistic update on error', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    mockMarkBatchWatched.mockRejectedValue(new Error('server error'));

    renderWithClient(<MarkMultipleConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-multiple').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    const rolledBack = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(rolledBack!.seasons[0].watchedEpisodeIds).toEqual(['ep-1']);
    expect(rolledBack!.seasons[0].watchedCount).toBe(1);
  });

  it('invalidates all related caches on settled', async () => {
    mockMarkBatchWatched.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<MarkMultipleConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-multiple').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userMedia.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.meLists.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userActions.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.savedItems.all }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not modify other seasons during optimistic update', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1']),
      buildSeason(2, 6, ['ep-20']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<MarkMultipleConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-multiple').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(optimistic!.seasons[1].watchedEpisodeIds).toEqual(['ep-20']);
    expect(optimistic!.seasons[1].watchedCount).toBe(1);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });
});

// ============================================================================
// useMarkAllEpisodesWatched
// ============================================================================

function MarkAllConsumer() {
  const mutation = useMarkAllEpisodesWatched(SHOW_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="mark-all"
        onClick={() => {
          const episodesBySeasonNumber = new Map<number, string[]>();
          episodesBySeasonNumber.set(1, ['ep-1', 'ep-2', 'ep-3']);
          episodesBySeasonNumber.set(2, ['ep-10', 'ep-11']);
          mutation.mutate({ episodesBySeasonNumber });
        }}
      />
    </div>
  );
}

describe('useMarkAllEpisodesWatched', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls markBatchWatched API with all episode IDs flattened', async () => {
    mockMarkBatchWatched.mockResolvedValue(undefined);

    renderWithClient(<MarkAllConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkBatchWatched).toHaveBeenCalledWith(
      expect.arrayContaining(['ep-1', 'ep-2', 'ep-3', 'ep-10', 'ep-11']),
    );
    expect(mockMarkBatchWatched.mock.calls[0][0]).toHaveLength(5);
  });

  it('optimistically sets all seasons to fully watched', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 3, ['ep-1']),
      buildSeason(2, 2, []),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<MarkAllConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    // Season 1 should have all episodes marked
    expect(optimistic!.seasons[0].watchedEpisodeIds).toEqual(['ep-1', 'ep-2', 'ep-3']);
    expect(optimistic!.seasons[0].watchedCount).toBe(3);

    // Season 2 should have all episodes marked
    expect(optimistic!.seasons[1].watchedEpisodeIds).toEqual(['ep-10', 'ep-11']);
    expect(optimistic!.seasons[1].watchedCount).toBe(2);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('does not modify seasons not in the map', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 3, ['ep-1']),
      buildSeason(2, 2, []),
      buildSeason(3, 4, ['ep-30']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchWatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<MarkAllConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    // Season 3 was not in the Map, so should remain unchanged
    expect(optimistic!.seasons[2].watchedEpisodeIds).toEqual(['ep-30']);
    expect(optimistic!.seasons[2].watchedCount).toBe(1);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('invalidates cache on error instead of rolling back (partial chunks may have succeeded)', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 3, ['ep-1']),
      buildSeason(2, 2, []),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    mockMarkBatchWatched.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<MarkAllConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    // On error, cache is invalidated (not rolled back) because partial chunks
    // may have already succeeded on the server.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
  });

  it('invalidates all related caches on settled', async () => {
    mockMarkBatchWatched.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<MarkAllConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userMedia.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.meLists.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userActions.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.savedItems.all }),
    );

    invalidateSpy.mockRestore();
  });
});

// ============================================================================
// useUnmarkEpisodes
// ============================================================================

function UnmarkEpisodesConsumer() {
  const mutation = useUnmarkEpisodes(SHOW_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="unmark"
        onClick={() => mutation.mutate(['ep-1', 'ep-2', 'ep-3'])}
      />
      <button
        data-testid="unmark-empty"
        onClick={() => mutation.mutate([])}
      />
    </div>
  );
}

describe('useUnmarkEpisodes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls markBatchUnwatched API with correct episode IDs', async () => {
    mockMarkBatchUnwatched.mockResolvedValue(undefined);

    renderWithClient(<UnmarkEpisodesConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('unmark').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkBatchUnwatched).toHaveBeenCalledWith(['ep-1', 'ep-2', 'ep-3']);
  });

  it('does not call API when episode list is empty', async () => {
    renderWithClient(<UnmarkEpisodesConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('unmark-empty').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkBatchUnwatched).not.toHaveBeenCalled();
  });

  it('invalidates all related caches on settled', async () => {
    mockMarkBatchUnwatched.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<UnmarkEpisodesConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('unmark').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userMedia.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.meLists.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userActions.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.savedItems.all }),
    );

    invalidateSpy.mockRestore();
  });

  it('invalidates caches even when API call fails', async () => {
    mockMarkBatchUnwatched.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<UnmarkEpisodesConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('unmark').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    // onSettled fires on both success and error
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('invalidates caches even when submitting empty list', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<UnmarkEpisodesConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('unmark-empty').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    // onSettled still fires even for no-op mutations
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

// ============================================================================
// useResetSeason
// ============================================================================

function ResetSeasonConsumer() {
  const mutation = useResetSeason(SHOW_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="reset-season"
        onClick={() =>
          mutation.mutate({
            episodeIds: ['ep-1', 'ep-2', 'ep-3'],
            seasonNumber: 1,
          })
        }
      />
    </div>
  );
}

describe('useResetSeason', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls markBatchUnwatched with the correct episode IDs', async () => {
    mockMarkBatchUnwatched.mockResolvedValue(undefined);

    renderWithClient(<ResetSeasonConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('reset-season').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkBatchUnwatched).toHaveBeenCalledWith(['ep-1', 'ep-2', 'ep-3']);
  });

  it('optimistically sets the target season watchedCount to 0 and watchedEpisodeIds to []', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2', 'ep-3']),
      buildSeason(2, 6, ['ep-20']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchUnwatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<ResetSeasonConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('reset-season').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(optimistic!.seasons[0].watchedCount).toBe(0);
    expect(optimistic!.seasons[0].watchedEpisodeIds).toEqual([]);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('optimistic update does not modify other seasons', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2', 'ep-3']),
      buildSeason(2, 6, ['ep-20', 'ep-21']),
      buildSeason(3, 10, ['ep-30']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    let resolveMutation: (value: any) => void;
    mockMarkBatchUnwatched.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<ResetSeasonConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('reset-season').click();
    });

    const optimistic = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    // Season 2 and 3 must remain untouched
    expect(optimistic!.seasons[1].watchedEpisodeIds).toEqual(['ep-20', 'ep-21']);
    expect(optimistic!.seasons[1].watchedCount).toBe(2);
    expect(optimistic!.seasons[2].watchedEpisodeIds).toEqual(['ep-30']);
    expect(optimistic!.seasons[2].watchedCount).toBe(1);

    await act(async () => {
      resolveMutation!(undefined);
    });
  });

  it('rolls back to previous progress on error', async () => {
    const initialProgress = buildProgress([
      buildSeason(1, 8, ['ep-1', 'ep-2', 'ep-3']),
    ]);

    queryClient.setQueryData(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
      initialProgress,
    );

    mockMarkBatchUnwatched.mockRejectedValue(new Error('server error'));

    renderWithClient(<ResetSeasonConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('reset-season').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    const rolledBack = queryClient.getQueryData<ShowProgressDto>(
      queryKeys.episodeProgress.showProgress(SHOW_ID),
    );

    expect(rolledBack!.seasons[0].watchedEpisodeIds).toEqual(['ep-1', 'ep-2', 'ep-3']);
    expect(rolledBack!.seasons[0].watchedCount).toBe(3);
  });

  it('invalidates all related caches on settled', async () => {
    mockMarkBatchUnwatched.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<ResetSeasonConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('reset-season').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.episodeProgress.showProgress(SHOW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userMedia.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.meLists.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.userActions.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.savedItems.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.shows.personalizedCalendarAll }),
    );

    invalidateSpy.mockRestore();
  });
});
