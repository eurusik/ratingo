import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAutoUnsaveOnRating } from '../use-auto-unsave-on-rating';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUnsaveItem = jest.fn<Promise<any>, [any]>();
const mockSaveItem = jest.fn<Promise<any>, [any]>();

jest.mock('sonner', () => ({
  toast: jest.fn(),
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      userRating: {
        toast: {
          removedFromSaved: '{emoji} {score} · Removed from saved',
          undo: 'Undo',
        },
      },
    },
  }),
}));

jest.mock('@/core/query', () => ({
  useUnsaveItem: () => ({ mutateAsync: mockUnsaveItem }),
  useSaveItem: () => ({ mutateAsync: mockSaveItem }),
}));

import { toast } from 'sonner';
const mockToast = toast as unknown as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEDIA_ID = 'media-42';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function seedSaveStatus(
  queryClient: QueryClient,
  mediaItemId: string,
  status: { isForLater: boolean; isConsidering: boolean },
) {
  const { queryKeys } = jest.requireActual('@/core/query/keys');
  queryClient.setQueryData(
    queryKeys.userActions.savedItems.status(mediaItemId),
    status,
  );
}

function renderAutoUnsaveHook(mediaItemId: string, queryClient: QueryClient) {
  return renderHook(() => useAutoUnsaveOnRating(mediaItemId), {
    wrapper: ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutoUnsaveOnRating', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
    mockUnsaveItem.mockResolvedValue({ status: { isForLater: false, isConsidering: false } });
    mockSaveItem.mockResolvedValue({ status: { isForLater: true, isConsidering: false } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // =========================================================================
  // Completed / no active state — should unsave
  // =========================================================================

  it('unsaves from for_later when pre-rating state is completed', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'completed');
    });

    expect(mockUnsaveItem).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      list: 'for_later',
      context: 'auto_on_rate',
    });

    expect(mockToast).toHaveBeenCalledWith(
      '😍 85 · Removed from saved',
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );
  });

  it('unsaves from considering when pre-rating state is dropped', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: false, isConsidering: true });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(15, '😐', 'dropped');
    });

    expect(mockUnsaveItem).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      list: 'considering',
      context: 'auto_on_rate',
    });
  });

  it('unsaves when pre-rating state is planned', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊', 'planned');
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
  });

  it('unsaves when pre-rating state is undefined (first-time rating)', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', undefined);
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
  });

  it('unsaves when pre-rating state is null (no prior entry)', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', null);
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
  });

  // =========================================================================
  // Active states — should NOT unsave
  // =========================================================================

  it('does NOT unsave when pre-rating state is watching', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'watching');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does NOT unsave when pre-rating state is paused', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'paused');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Not saved — no-op
  // =========================================================================

  it('does NOT unsave when not in any saved list', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: false, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊', 'completed');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // No save status cache — no-op
  // =========================================================================

  it('does NOT unsave when save status is not in cache', async () => {
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊', 'completed');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Undo action re-saves to original list
  // =========================================================================

  it('undo action re-saves to the original list', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'completed');
    });

    const toastCall = mockToast.mock.calls[0];
    const undoOnClick = toastCall[1].action.onClick;

    await act(async () => {
      undoOnClick();
    });

    expect(mockSaveItem).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      list: 'for_later',
      context: 'undo_auto_on_rate',
    });
  });

  // =========================================================================
  // Unsave failure — silent, no toast
  // =========================================================================

  it('silently catches unsave errors without showing toast', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    mockUnsaveItem.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'completed');
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Prefers for_later over considering when both are true
  // =========================================================================

  it('prefers for_later when both lists are active', async () => {
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: true });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍', 'completed');
    });

    expect(mockUnsaveItem).toHaveBeenCalledWith(
      expect.objectContaining({ list: 'for_later' }),
    );
  });
});
