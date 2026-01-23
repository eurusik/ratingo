import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedStatusProvider, useSavedStatusContext, updateBatchCaches } from '../saved-status-provider';

jest.mock('@/core/auth', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}));

jest.mock('@/core/api/user-actions.client', () => ({
  userActionsApi: {
    getBatchSaveStatus: jest.fn(),
  },
}));

import { useAuth } from '@/core/auth';
import { userActionsApi } from '@/core/api/user-actions.client';

const mockUseAuth = useAuth as jest.Mock;
const mockGetBatchSaveStatus = userActionsApi.getBatchSaveStatus as jest.Mock;

function TestConsumer({ mediaItemId }: { mediaItemId: string }) {
  const context = useSavedStatusContext();
  const status = context?.getStatus(mediaItemId);
  return (
    <div>
      <span data-testid="is-for-later">{status?.isForLater ? 'true' : 'false'}</span>
      <span data-testid="is-loading">{context?.isLoading ? 'true' : 'false'}</span>
      <button data-testid="invalidate" onClick={() => context?.invalidate()}>
        Invalidate
      </button>
    </div>
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithProvider(
  mediaItemIds: string[],
  testMediaItemId: string,
  queryClient: QueryClient,
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SavedStatusProvider mediaItemIds={mediaItemIds}>
        <TestConsumer mediaItemId={testMediaItemId} />
      </SavedStatusProvider>
    </QueryClientProvider>,
  );
}

describe('SavedStatusProvider', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetBatchSaveStatus.mockResolvedValue({});
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('getStatus', () => {
    it('reflects optimistic updates via updateBatchCaches', async () => {
      const mediaItemId = 'item-1';

      mockGetBatchSaveStatus.mockResolvedValue({
        [mediaItemId]: { isForLater: false, isConsidering: false },
      });

      renderWithProvider([mediaItemId], mediaItemId, queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('is-for-later').textContent).toBe('false');
      });

      act(() => {
        updateBatchCaches(queryClient, mediaItemId, { isForLater: true, isConsidering: false });
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-for-later').textContent).toBe('true');
      });
    });

    it('falls back to batch data when individual cache is empty', async () => {
      const mediaItemId = 'item-2';

      mockGetBatchSaveStatus.mockResolvedValue({
        [mediaItemId]: { isForLater: true, isConsidering: false },
      });

      renderWithProvider([mediaItemId], mediaItemId, queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByTestId('is-for-later').textContent).toBe('true');
    });

    it('returns undefined for unknown media item', async () => {
      mockGetBatchSaveStatus.mockResolvedValue({});

      renderWithProvider(['item-1'], 'unknown-item', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByTestId('is-for-later').textContent).toBe('false');
    });
  });

  describe('batch fetching', () => {
    it('does not fetch when not authenticated', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false });

      renderWithProvider(['item-1'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchSaveStatus).not.toHaveBeenCalled();
    });

    it('does not fetch when no media item IDs provided', async () => {
      renderWithProvider([], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchSaveStatus).not.toHaveBeenCalled();
    });

    it('deduplicates media item IDs', async () => {
      mockGetBatchSaveStatus.mockResolvedValue({});

      renderWithProvider(['item-1', 'item-1', 'item-2', 'item-2'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchSaveStatus).toHaveBeenCalledWith(['item-1', 'item-2']);
    });

    it('filters out empty IDs', async () => {
      mockGetBatchSaveStatus.mockResolvedValue({});

      renderWithProvider(['item-1', '', 'item-2'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchSaveStatus).toHaveBeenCalledWith(['item-1', 'item-2']);
    });
  });

  describe('useSavedStatusContext', () => {
    it('returns null when used outside provider', () => {
      function OutsideConsumer() {
        const context = useSavedStatusContext();
        return <span data-testid="context">{context === null ? 'null' : 'defined'}</span>;
      }

      render(
        <QueryClientProvider client={queryClient}>
          <OutsideConsumer />
        </QueryClientProvider>,
      );

      expect(screen.getByTestId('context').textContent).toBe('null');
    });
  });
});
