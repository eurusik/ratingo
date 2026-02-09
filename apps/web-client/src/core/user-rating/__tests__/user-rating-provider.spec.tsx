import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserRatingProvider, useUserRatingContext } from '../user-rating-provider';

jest.mock('@/core/auth', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}));

jest.mock('@/core/api/me-lists.client', () => ({
  meListsApi: {
    getBatchRatings: jest.fn(),
  },
}));

import { useAuth } from '@/core/auth';
import { meListsApi } from '@/core/api/me-lists.client';

const mockUseAuth = useAuth as jest.Mock;
const mockGetBatchRatings = meListsApi.getBatchRatings as jest.Mock;

function TestConsumer({ mediaItemId }: { mediaItemId: string }) {
  const context = useUserRatingContext();
  const rating = context?.getRating(mediaItemId);
  return (
    <div>
      <span data-testid="rating">{rating !== undefined ? String(rating) : 'undefined'}</span>
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
      <UserRatingProvider mediaItemIds={mediaItemIds}>
        <TestConsumer mediaItemId={testMediaItemId} />
      </UserRatingProvider>
    </QueryClientProvider>,
  );
}

describe('UserRatingProvider', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetBatchRatings.mockResolvedValue({});
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('getRating', () => {
    it('returns rating for a media item that has one', async () => {
      const mediaItemId = 'item-1';

      mockGetBatchRatings.mockResolvedValue({
        [mediaItemId]: 85,
      });

      renderWithProvider([mediaItemId], mediaItemId, queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('rating').textContent).toBe('85');
      });
    });

    it('returns undefined for a media item without rating', async () => {
      mockGetBatchRatings.mockResolvedValue({});

      renderWithProvider(['item-1'], 'unknown-item', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByTestId('rating').textContent).toBe('undefined');
    });
  });

  describe('batch fetching', () => {
    it('does not fetch when not authenticated', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false });

      renderWithProvider(['item-1'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchRatings).not.toHaveBeenCalled();
    });

    it('does not fetch when mediaItemIds is empty', async () => {
      renderWithProvider([], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchRatings).not.toHaveBeenCalled();
    });

    it('deduplicates media item IDs', async () => {
      mockGetBatchRatings.mockResolvedValue({});

      renderWithProvider(['item-1', 'item-1', 'item-2', 'item-2'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchRatings).toHaveBeenCalledWith(['item-1', 'item-2']);
    });

    it('filters out empty IDs', async () => {
      mockGetBatchRatings.mockResolvedValue({});

      renderWithProvider(['item-1', '', 'item-2'], 'item-1', queryClient);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockGetBatchRatings).toHaveBeenCalledWith(['item-1', 'item-2']);
    });
  });

  describe('loading state', () => {
    it('shows loading while fetching', async () => {
      let resolvePromise: (value: Record<string, number>) => void;
      mockGetBatchRatings.mockReturnValue(
        new Promise<Record<string, number>>((resolve) => {
          resolvePromise = resolve;
        }),
      );

      renderWithProvider(['item-1'], 'item-1', queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('true');
      });

      await act(async () => {
        resolvePromise!({ 'item-1': 70 });
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
        expect(screen.getByTestId('rating').textContent).toBe('70');
      });
    });
  });

  describe('useUserRatingContext', () => {
    it('returns null when used outside provider', () => {
      function OutsideConsumer() {
        const context = useUserRatingContext();
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
