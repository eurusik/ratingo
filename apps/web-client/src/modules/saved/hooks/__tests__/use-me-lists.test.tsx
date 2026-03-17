import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

import {
  useWatching,
  useCompleted,
  usePaused,
  useDropped,
  usePauseMedia,
  useResumeMedia,
  useDropMedia,
  useRestoreMedia,
  useFavoriteUpdates,
  useUserMediaState,
  useSetRating,
} from '../use-me-lists';
import { queryKeys } from '@/core/query/keys';

jest.mock('@/core/api/me-lists.client', () => ({
  meListsApi: {
    getActivity: jest.fn(),
    getRatings: jest.fn(),
    getHistory: jest.fn(),
    getPaused: jest.fn(),
    getDropped: jest.fn(),
    pauseMedia: jest.fn(),
    resumeMedia: jest.fn(),
    dropMedia: jest.fn(),
    restoreMedia: jest.fn(),
    getFavoriteUpdates: jest.fn(),
    getState: jest.fn(),
    setRating: jest.fn(),
  },
  USER_MEDIA_STATE: {
    WATCHING: 'watching',
    COMPLETED: 'completed',
    PLANNED: 'planned',
    DROPPED: 'dropped',
    PAUSED: 'paused',
  },
}));

import { meListsApi } from '@/core/api/me-lists.client';

const mockGetActivity = meListsApi.getActivity as jest.Mock;
const mockGetHistory = meListsApi.getHistory as jest.Mock;
const mockGetPaused = meListsApi.getPaused as jest.Mock;
const mockGetDropped = meListsApi.getDropped as jest.Mock;
const mockPauseMedia = meListsApi.pauseMedia as jest.Mock;
const mockResumeMedia = meListsApi.resumeMedia as jest.Mock;
const mockDropMedia = meListsApi.dropMedia as jest.Mock;
const mockRestoreMedia = meListsApi.restoreMedia as jest.Mock;
const mockGetFavoriteUpdates = meListsApi.getFavoriteUpdates as jest.Mock;
const mockGetState = meListsApi.getState as jest.Mock;
const mockSetRating = meListsApi.setRating as jest.Mock;

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

const MEDIA_ITEM_ID = 'media-item-1';

// -- Fixtures ----------------------------------------------------------------

function makeHistoryItem(overrides: Record<string, unknown> = {}) {
  return {
    mediaItemId: MEDIA_ITEM_ID,
    title: 'Test Title',
    state: 'watching',
    rating: null,
    ...overrides,
  };
}

function makeHistoryResponse(items: Record<string, unknown>[]) {
  return { data: items, total: items.length };
}

// -- Consumer components -----------------------------------------------------

function WatchingConsumer({ enabled }: { enabled?: boolean }) {
  const query = useWatching({ enabled });

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
      <span data-testid="count">{String(query.data?.data.length ?? 'none')}</span>
    </div>
  );
}

function CompletedConsumer({ sort, enabled }: { sort?: 'recent' | 'rating' | 'releaseDate'; enabled?: boolean }) {
  const query = useCompleted({ sort, enabled });

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
      <span data-testid="count">{String(query.data?.data.length ?? 'none')}</span>
    </div>
  );
}

function PausedConsumer({ sort, enabled }: { sort?: 'recent' | 'rating' | 'releaseDate'; enabled?: boolean }) {
  const query = usePaused({ sort, enabled });

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function DroppedConsumer({ sort, enabled }: { sort?: 'recent' | 'rating' | 'releaseDate'; enabled?: boolean }) {
  const query = useDropped({ sort, enabled });

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function FavoriteUpdatesConsumer({ enabled = true }: { enabled?: boolean }) {
  const query = useFavoriteUpdates(enabled);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function UserMediaStateConsumer({ mediaItemId, enabled = true }: { mediaItemId: string; enabled?: boolean }) {
  const query = useUserMediaState(mediaItemId, enabled);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function SetRatingConsumer() {
  const mutation = useSetRating(MEDIA_ITEM_ID);
  const query = useUserMediaState(MEDIA_ITEM_ID);

  // Distinguish: no data yet = 'none', data loaded but rating is null = 'null', number = the number
  const ratingDisplay = query.data === undefined
    ? 'none'
    : query.data === null
      ? 'no-state'
      : String(query.data.rating);

  return (
    <div>
      <span data-testid="rating">{ratingDisplay}</span>
      <span data-testid="query-status">{query.status}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="set-rating"
        onClick={() => mutation.mutate({ rating: 80, mediaType: 'movie' })}
      />
      <button
        data-testid="clear-rating"
        onClick={() => mutation.mutate({ rating: null, mediaType: 'movie' })}
      />
    </div>
  );
}

function PauseMediaConsumer() {
  const mutation = usePauseMedia();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="pause"
        onClick={() => mutation.mutate(MEDIA_ITEM_ID)}
      />
    </div>
  );
}

function ResumeMediaConsumer() {
  const mutation = useResumeMedia();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="resume"
        onClick={() => mutation.mutate(MEDIA_ITEM_ID)}
      />
    </div>
  );
}

function DropMediaConsumer() {
  const mutation = useDropMedia();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="drop"
        onClick={() => mutation.mutate(MEDIA_ITEM_ID)}
      />
    </div>
  );
}

function RestoreMediaConsumer() {
  const mutation = useRestoreMedia();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="restore"
        onClick={() => mutation.mutate(MEDIA_ITEM_ID)}
      />
    </div>
  );
}

// -- Tests -------------------------------------------------------------------

describe('useWatching', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('returns watching items from getActivity', async () => {
    const items = [
      makeHistoryItem({ mediaItemId: 'w1', state: 'watching' }),
      makeHistoryItem({ mediaItemId: 'w2', state: 'watching' }),
    ];
    mockGetActivity.mockResolvedValue(makeHistoryResponse(items));

    renderWithClient(<WatchingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(screen.getByTestId('count').textContent).toBe('2');

    const data = JSON.parse(screen.getByTestId('data').textContent!);
    expect(data.data).toHaveLength(2);
    expect(data.data.every((item: { state: string }) => item.state === 'watching')).toBe(true);
  });

  it('returns empty array when no watching items exist', async () => {
    mockGetActivity.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<WatchingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('returns undefined data when query has not loaded', async () => {
    mockGetActivity.mockImplementation(() => new Promise(() => {}));

    renderWithClient(<WatchingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('pending');
    });

    expect(screen.getByTestId('data').textContent).toBe('null');
  });

  it('calls API with default limit', async () => {
    mockGetActivity.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<WatchingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetActivity).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('does not fetch when enabled is false', async () => {
    renderWithClient(<WatchingConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetActivity).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

describe('useCompleted', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('filters history items to only completed state', async () => {
    const items = [
      makeHistoryItem({ mediaItemId: 'w1', state: 'watching' }),
      makeHistoryItem({ mediaItemId: 'c1', state: 'completed' }),
      makeHistoryItem({ mediaItemId: 'c2', state: 'completed' }),
    ];
    mockGetHistory.mockResolvedValue(makeHistoryResponse(items));

    renderWithClient(<CompletedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(screen.getByTestId('count').textContent).toBe('2');

    const data = JSON.parse(screen.getByTestId('data').textContent!);
    expect(data.data).toHaveLength(2);
    expect(data.data.every((item: { state: string }) => item.state === 'completed')).toBe(true);
  });

  it('returns empty array when no completed items exist', async () => {
    const items = [
      makeHistoryItem({ mediaItemId: 'w1', state: 'watching' }),
    ];
    mockGetHistory.mockResolvedValue(makeHistoryResponse(items));

    renderWithClient(<CompletedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('passes sort parameter to the API call', async () => {
    mockGetHistory.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<CompletedConsumer sort="releaseDate" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetHistory).toHaveBeenCalledWith(expect.objectContaining({ sort: 'releaseDate' }));
  });

  it('does not fetch when enabled is false', async () => {
    renderWithClient(<CompletedConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetHistory).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

describe('usePaused', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches paused items', async () => {
    const items = [
      makeHistoryItem({ mediaItemId: 'p1', state: 'paused' }),
    ];
    mockGetPaused.mockResolvedValue(makeHistoryResponse(items));

    renderWithClient(<PausedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    const data = JSON.parse(screen.getByTestId('data').textContent!);
    expect(data.data).toHaveLength(1);
  });

  it('passes sort parameter to the API call', async () => {
    mockGetPaused.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<PausedConsumer sort="recent" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetPaused).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recent' }));
  });

  it('calls API with default limit when sort is undefined', async () => {
    mockGetPaused.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<PausedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetPaused).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('does not fetch when enabled is false', async () => {
    renderWithClient(<PausedConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetPaused).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

describe('useDropped', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches dropped items', async () => {
    const items = [
      makeHistoryItem({ mediaItemId: 'd1', state: 'dropped' }),
    ];
    mockGetDropped.mockResolvedValue(makeHistoryResponse(items));

    renderWithClient(<DroppedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    const data = JSON.parse(screen.getByTestId('data').textContent!);
    expect(data.data).toHaveLength(1);
  });

  it('passes sort parameter to the API call', async () => {
    mockGetDropped.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<DroppedConsumer sort="recent" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetDropped).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recent' }));
  });

  it('calls API with default limit when sort is undefined', async () => {
    mockGetDropped.mockResolvedValue(makeHistoryResponse([]));

    renderWithClient(<DroppedConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetDropped).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('does not fetch when enabled is false', async () => {
    renderWithClient(<DroppedConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetDropped).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

describe('useFavoriteUpdates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches favorite updates when enabled', async () => {
    const mockData = { shows: [{ id: 's1', title: 'Show 1' }] };
    mockGetFavoriteUpdates.mockResolvedValue(mockData);

    renderWithClient(<FavoriteUpdatesConsumer enabled />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetFavoriteUpdates).toHaveBeenCalled();
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(mockData));
  });

  it('does not fetch when disabled', async () => {
    renderWithClient(<FavoriteUpdatesConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetFavoriteUpdates).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });

  it('defaults to enabled when no argument provided', async () => {
    const mockData = { shows: [] };
    mockGetFavoriteUpdates.mockResolvedValue(mockData);

    function DefaultEnabledConsumer() {
      const query = useFavoriteUpdates();
      return <span data-testid="status">{query.status}</span>;
    }

    renderWithClient(<DefaultEnabledConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetFavoriteUpdates).toHaveBeenCalled();
  });
});

describe('useUserMediaState', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches media state for a given mediaItemId', async () => {
    const stateData = makeHistoryItem({ rating: 70 });
    mockGetState.mockResolvedValue(stateData);

    renderWithClient(<UserMediaStateConsumer mediaItemId={MEDIA_ITEM_ID} />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetState).toHaveBeenCalledWith(MEDIA_ITEM_ID);
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(stateData));
  });

  it('does not fetch when enabled is false', async () => {
    renderWithClient(<UserMediaStateConsumer mediaItemId={MEDIA_ITEM_ID} enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetState).not.toHaveBeenCalled();
  });

  it('does not fetch when mediaItemId is empty string', async () => {
    renderWithClient(<UserMediaStateConsumer mediaItemId="" />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetState).not.toHaveBeenCalled();
  });
});

describe('useSetRating', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls setRating API with correct arguments', async () => {
    const serverResponse = makeHistoryItem({ rating: 80 });
    mockGetState.mockResolvedValue(makeHistoryItem({ rating: null }));
    mockSetRating.mockResolvedValue(serverResponse);

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockSetRating).toHaveBeenCalledWith(MEDIA_ITEM_ID, 80, 'movie');
  });

  it('optimistically updates rating when previousState exists', async () => {
    const previousState = makeHistoryItem({ rating: null });
    mockGetState.mockResolvedValue(previousState);

    let resolveMutation: (value: unknown) => void;
    mockSetRating.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('null');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    // Optimistic update should show the new rating immediately
    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('80');
    });

    // Resolve mutation
    await act(async () => {
      resolveMutation!(makeHistoryItem({ rating: 80 }));
    });
  });

  it('does not apply optimistic update when previousState is missing', async () => {
    // No cached state exists — API returns null
    mockGetState.mockResolvedValue(null);

    let resolveMutation: (value: unknown) => void;
    mockSetRating.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<SetRatingConsumer />, queryClient);

    // Wait for the state query to settle with null
    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('rating').textContent).toBe('no-state');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    // With null previousState (getQueryData returns null),
    // the optimistic update branch is skipped
    expect(screen.getByTestId('rating').textContent).toBe('no-state');

    await act(async () => {
      resolveMutation!(makeHistoryItem({ rating: 80 }));
    });
  });

  it('replaces optimistic data with server response on success', async () => {
    mockGetState.mockResolvedValue(makeHistoryItem({ rating: 50 }));
    // Server returns different rating than what was optimistically set
    mockSetRating.mockResolvedValue(makeHistoryItem({ rating: 80, state: 'completed' }));

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('50');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    // Server response should be the final data
    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('80');
    });
  });

  it('rolls back optimistic update on error', async () => {
    const previousState = makeHistoryItem({ rating: 50 });
    mockGetState.mockResolvedValue(previousState);
    mockSetRating.mockRejectedValue(new Error('server error'));

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('50');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    // After error, should roll back to the previous rating
    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('50');
    });
  });

  it('clears rating via null', async () => {
    mockGetState.mockResolvedValue(makeHistoryItem({ rating: 80 }));
    mockSetRating.mockResolvedValue(makeHistoryItem({ rating: null }));

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('rating').textContent).toBe('80');
    });

    await act(async () => {
      screen.getByTestId('clear-rating').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockSetRating).toHaveBeenCalledWith(MEDIA_ITEM_ID, null, 'movie');
  });

  it('invalidates batchRatingsAll, favoriteUpdates, reviews on settled', async () => {
    mockGetState.mockResolvedValue(makeHistoryItem({ rating: null }));
    mockSetRating.mockResolvedValue(makeHistoryItem({ rating: 80 }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userMedia.batchRatingsAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.favoriteUpdates,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.myReview(MEDIA_ITEM_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ITEM_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('invalidates caches even on error (onSettled fires for both)', async () => {
    mockGetState.mockResolvedValue(makeHistoryItem({ rating: null }));
    mockSetRating.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<SetRatingConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('set-rating').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userMedia.batchRatingsAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.favoriteUpdates,
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('usePauseMedia', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls pauseMedia API with the mediaItemId', async () => {
    mockPauseMedia.mockResolvedValue(makeHistoryItem({ state: 'paused' }));

    renderWithClient(<PauseMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('pause').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockPauseMedia).toHaveBeenCalledWith(MEDIA_ITEM_ID);
  });

  it('invalidates historyAll and pausedAll on success', async () => {
    mockPauseMedia.mockResolvedValue(makeHistoryItem({ state: 'paused' }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<PauseMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('pause').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.historyAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.pausedAll,
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockPauseMedia.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<PauseMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('pause').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

describe('useResumeMedia', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls resumeMedia API with the mediaItemId', async () => {
    mockResumeMedia.mockResolvedValue(makeHistoryItem({ state: 'watching' }));

    renderWithClient(<ResumeMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('resume').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockResumeMedia).toHaveBeenCalledWith(MEDIA_ITEM_ID);
  });

  it('invalidates historyAll and pausedAll on success', async () => {
    mockResumeMedia.mockResolvedValue(makeHistoryItem({ state: 'watching' }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<ResumeMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('resume').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.historyAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.pausedAll,
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockResumeMedia.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<ResumeMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('resume').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

describe('useDropMedia', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls dropMedia API with the mediaItemId', async () => {
    mockDropMedia.mockResolvedValue(makeHistoryItem({ state: 'dropped' }));

    renderWithClient(<DropMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('drop').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockDropMedia).toHaveBeenCalledWith(MEDIA_ITEM_ID);
  });

  it('invalidates historyAll, pausedAll, watchlistAll, and droppedAll on success', async () => {
    mockDropMedia.mockResolvedValue(makeHistoryItem({ state: 'dropped' }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<DropMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('drop').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.historyAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.pausedAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.watchlistAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.droppedAll,
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockDropMedia.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<DropMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('drop').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

describe('useRestoreMedia', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls restoreMedia API with the mediaItemId', async () => {
    mockRestoreMedia.mockResolvedValue(makeHistoryItem({ state: 'watching' }));

    renderWithClient(<RestoreMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('restore').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockRestoreMedia).toHaveBeenCalledWith(MEDIA_ITEM_ID);
  });

  it('invalidates historyAll, watchlistAll, and droppedAll on success', async () => {
    mockRestoreMedia.mockResolvedValue(makeHistoryItem({ state: 'watching' }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<RestoreMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('restore').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.historyAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.watchlistAll,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.meLists.droppedAll,
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockRestoreMedia.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<RestoreMediaConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('restore').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});
