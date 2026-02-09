import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

import { queryKeys } from '../keys';
import { useSaveItem, useUnsaveItem, useSaveStatus } from '../saved-items';

jest.mock('@/core/api', () => ({
  userActionsApi: {
    getSaveStatus: jest.fn(),
    saveItem: jest.fn(),
    unsaveItem: jest.fn(),
  },
}));

jest.mock('@/core/saved-status/saved-status-provider', () => ({
  updateBatchCaches: jest.fn(),
}));

import { userActionsApi } from '@/core/api';
import { updateBatchCaches } from '@/core/saved-status/saved-status-provider';

const mockSaveItem = userActionsApi.saveItem as jest.Mock;
const mockUnsaveItem = userActionsApi.unsaveItem as jest.Mock;
const mockGetSaveStatus = userActionsApi.getSaveStatus as jest.Mock;
const mockUpdateBatchCaches = updateBatchCaches as jest.Mock;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const MEDIA_ID = 'media-item-1';

function SaveItemConsumer() {
  const mutation = useSaveItem();
  const query = useSaveStatus(MEDIA_ID, { enabled: true });

  return (
    <div>
      <span data-testid="is-for-later">{String(query.data?.isForLater ?? 'undefined')}</span>
      <span data-testid="is-considering">{String(query.data?.isConsidering ?? 'undefined')}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="save-for-later"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, list: 'for_later' })}
      />
      <button
        data-testid="save-considering"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, list: 'considering' })}
      />
    </div>
  );
}

function UnsaveItemConsumer() {
  const mutation = useUnsaveItem();
  const query = useSaveStatus(MEDIA_ID, { enabled: true });

  return (
    <div>
      <span data-testid="is-for-later">{String(query.data?.isForLater ?? 'undefined')}</span>
      <span data-testid="is-considering">{String(query.data?.isConsidering ?? 'undefined')}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="unsave-for-later"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, list: 'for_later' })}
      />
      <button
        data-testid="unsave-considering"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, list: 'considering' })}
      />
    </div>
  );
}

function renderWithClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('useSaveItem', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
    mockGetSaveStatus.mockResolvedValue({ isForLater: false, isConsidering: false });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('optimistically sets isForLater when saving to for_later', async () => {
    let resolveMutation: (value: any) => void;
    mockSaveItem.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<SaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('save-for-later').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
      expect(screen.getByTestId('is-considering').textContent).toBe('false');
    });

    expect(mockUpdateBatchCaches).toHaveBeenCalledWith(
      expect.anything(),
      MEDIA_ID,
      { isForLater: true, isConsidering: false },
    );

    await act(async () => {
      resolveMutation!({ status: { isForLater: true, isConsidering: false } });
    });
  });

  it('optimistically sets isConsidering when saving to considering', async () => {
    let resolveMutation: (value: any) => void;
    mockSaveItem.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<SaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-considering').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('save-considering').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-considering').textContent).toBe('true');
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
    });

    await act(async () => {
      resolveMutation!({ status: { isForLater: false, isConsidering: true } });
    });
  });

  it('replaces optimistic data with server response on success', async () => {
    mockSaveItem.mockResolvedValue({
      status: { isForLater: true, isConsidering: true },
    });

    renderWithClient(<SaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
    });

    // After mutation fires, onSettled invalidates status query triggering a refetch.
    // Ensure the refetch returns the same server state as the mutation response.
    mockGetSaveStatus.mockResolvedValue({ isForLater: true, isConsidering: true });

    await act(async () => {
      screen.getByTestId('save-for-later').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
      expect(screen.getByTestId('is-considering').textContent).toBe('true');
    });
  });

  it('rolls back on error and calls updateBatchCaches with previous status', async () => {
    const previousStatus = { isForLater: false, isConsidering: false };
    mockSaveItem.mockRejectedValue(new Error('server error'));

    renderWithClient(<SaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('save-for-later').click();
    });

    // After error, rolls back to original
    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
      expect(screen.getByTestId('is-considering').textContent).toBe('false');
    });

    // updateBatchCaches called with rollback status
    const calls = mockUpdateBatchCaches.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe(MEDIA_ID);
    expect(lastCall[2]).toEqual(previousStatus);
  });
});

describe('useUnsaveItem', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('clears isForLater while preserving isConsidering', async () => {
    mockGetSaveStatus.mockResolvedValue({ isForLater: true, isConsidering: true });

    let resolveMutation: (value: any) => void;
    mockUnsaveItem.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnsaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsave-for-later').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
      expect(screen.getByTestId('is-considering').textContent).toBe('true');
    });

    await act(async () => {
      resolveMutation!({ status: { isForLater: false, isConsidering: true } });
    });
  });

  it('clears isConsidering while preserving isForLater', async () => {
    mockGetSaveStatus.mockResolvedValue({ isForLater: true, isConsidering: true });

    let resolveMutation: (value: any) => void;
    mockUnsaveItem.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnsaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-considering').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsave-considering').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-considering').textContent).toBe('false');
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
    });

    await act(async () => {
      resolveMutation!({ status: { isForLater: true, isConsidering: false } });
    });
  });

  it('rolls back on error', async () => {
    const original = { isForLater: true, isConsidering: true };
    mockGetSaveStatus.mockResolvedValue(original);
    mockUnsaveItem.mockRejectedValue(new Error('server error'));

    renderWithClient(<UnsaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsave-for-later').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
      expect(screen.getByTestId('is-considering').textContent).toBe('true');
    });
  });

  it('invalidates saved item list queries on success', async () => {
    mockGetSaveStatus.mockResolvedValue({ isForLater: true, isConsidering: false });
    mockUnsaveItem.mockResolvedValue({ status: { isForLater: false, isConsidering: false } });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<UnsaveItemConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsave-for-later').click();
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: [...queryKeys.userActions.savedItems.all, 'list'],
        }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: queryKeys.savedItems.all,
        }),
      );
    });

    invalidateSpy.mockRestore();
  });
});
