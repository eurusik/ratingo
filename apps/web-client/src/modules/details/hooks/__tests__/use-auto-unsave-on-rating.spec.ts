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

function seedUserMediaState(
  queryClient: QueryClient,
  mediaItemId: string,
  state: string,
) {
  const { queryKeys } = jest.requireActual('@/core/query/keys');
  queryClient.setQueryData(
    queryKeys.userMedia.state(mediaItemId),
    { state, rating: 85 },
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

  it('unsaves from for_later when state is completed', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
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

  it('unsaves from considering when state is dropped', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'dropped');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: false, isConsidering: true });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(15, '😐');
    });

    expect(mockUnsaveItem).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      list: 'considering',
      context: 'auto_on_rate',
    });
  });

  it('unsaves when state is planned', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'planned');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊');
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
  });

  it('unsaves when no user media state in cache (e.g. first-time rating)', async () => {
    // No userMediaState seeded — cache returns undefined
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
  });

  // =========================================================================
  // Active states — should NOT unsave
  // =========================================================================

  it('does NOT unsave when state is watching', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'watching');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does NOT unsave when state is paused', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'paused');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Not saved — no-op
  // =========================================================================

  it('does NOT unsave when not in any saved list', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: false, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // No save status cache — no-op
  // =========================================================================

  it('does NOT unsave when save status is not in cache', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    // No save status seeded
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(75, '😊');
    });

    expect(mockUnsaveItem).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Undo action re-saves to original list
  // =========================================================================

  it('undo action re-saves to the original list', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
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
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: false });
    mockUnsaveItem.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
    });

    expect(mockUnsaveItem).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Prefers for_later over considering when both are true
  // =========================================================================

  it('prefers for_later when both lists are active', async () => {
    seedUserMediaState(queryClient, MEDIA_ID, 'completed');
    seedSaveStatus(queryClient, MEDIA_ID, { isForLater: true, isConsidering: true });
    const { result } = renderAutoUnsaveHook(MEDIA_ID, queryClient);

    await act(async () => {
      await result.current.tryAutoUnsave(85, '😍');
    });

    expect(mockUnsaveItem).toHaveBeenCalledWith(
      expect.objectContaining({ list: 'for_later' }),
    );
  });
});
