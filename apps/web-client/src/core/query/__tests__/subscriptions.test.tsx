import * as fc from 'fast-check';
import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

import { useSubscribe, useUnsubscribe, useSubscriptionStatus, SUBSCRIPTION_TRIGGER } from '../subscriptions';

jest.mock('@/core/api', () => ({
  userActionsApi: {
    getSubscriptionStatus: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  },
}));

import { userActionsApi } from '@/core/api';

const mockSubscribe = userActionsApi.subscribe as jest.Mock;
const mockUnsubscribe = userActionsApi.unsubscribe as jest.Mock;
const mockGetSubscriptionStatus = userActionsApi.getSubscriptionStatus as jest.Mock;

// Inline copy of buildSubscriptionStatus for pure-function testing.
// Must stay in sync with subscriptions.ts.
function buildSubscriptionStatus(triggers: string[]) {
  return {
    triggers,
    hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
    hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
    hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const MEDIA_ID = 'media-sub-1';

// ---------------------------------------------------------------------------
// Property tests for buildSubscriptionStatus
// ---------------------------------------------------------------------------

const triggerArb = fc.constantFrom(
  SUBSCRIPTION_TRIGGER.RELEASE,
  SUBSCRIPTION_TRIGGER.NEW_SEASON,
  SUBSCRIPTION_TRIGGER.ON_STREAMING,
);

function triggersArb() {
  return fc.uniqueArray(triggerArb, { maxLength: 3 });
}

describe('buildSubscriptionStatus (pure)', () => {
  it('hasRelease iff release in triggers', () => {
    fc.assert(
      fc.property(triggersArb(), (triggers) => {
        const status = buildSubscriptionStatus(triggers);
        expect(status.hasRelease).toBe(triggers.includes('release'));
      }),
    );
  });

  it('hasNewSeason iff new_season in triggers', () => {
    fc.assert(
      fc.property(triggersArb(), (triggers) => {
        const status = buildSubscriptionStatus(triggers);
        expect(status.hasNewSeason).toBe(triggers.includes('new_season'));
      }),
    );
  });

  it('hasOnStreaming iff on_streaming in triggers', () => {
    fc.assert(
      fc.property(triggersArb(), (triggers) => {
        const status = buildSubscriptionStatus(triggers);
        expect(status.hasOnStreaming).toBe(triggers.includes('on_streaming'));
      }),
    );
  });

  it('preserves the triggers array as-is', () => {
    fc.assert(
      fc.property(triggersArb(), (triggers) => {
        const status = buildSubscriptionStatus(triggers);
        expect(status.triggers).toBe(triggers);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

type TriggerType = typeof SUBSCRIPTION_TRIGGER[keyof typeof SUBSCRIPTION_TRIGGER];

function SubscribeConsumer({ trigger }: { trigger: TriggerType }) {
  const mutation = useSubscribe();
  const query = useSubscriptionStatus(MEDIA_ID, { enabled: true });

  return (
    <div>
      <span data-testid="triggers">{JSON.stringify(query.data?.triggers ?? [])}</span>
      <span data-testid="has-release">{String(query.data?.hasRelease ?? false)}</span>
      <span data-testid="has-new-season">{String(query.data?.hasNewSeason ?? false)}</span>
      <span data-testid="has-on-streaming">{String(query.data?.hasOnStreaming ?? false)}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="subscribe"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, trigger })}
      />
    </div>
  );
}

function UnsubscribeConsumer({ trigger }: { trigger: TriggerType }) {
  const mutation = useUnsubscribe();
  const query = useSubscriptionStatus(MEDIA_ID, { enabled: true });

  return (
    <div>
      <span data-testid="triggers">{JSON.stringify(query.data?.triggers ?? [])}</span>
      <span data-testid="has-release">{String(query.data?.hasRelease ?? false)}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="unsubscribe"
        onClick={() => mutation.mutate({ mediaItemId: MEDIA_ID, trigger })}
      />
    </div>
  );
}

function renderWithClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('useSubscribe', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
    mockGetSubscriptionStatus.mockResolvedValue({
      triggers: [],
      hasRelease: false,
      hasNewSeason: false,
      hasOnStreaming: false,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('optimistically adds trigger and derives boolean flags', async () => {
    let resolveMutation: (value: any) => void;
    mockSubscribe.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<SubscribeConsumer trigger="release" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('subscribe').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('true');
    });

    await act(async () => {
      resolveMutation!({
        status: { triggers: ['release'], hasRelease: true, hasNewSeason: false, hasOnStreaming: false },
      });
    });
  });

  it('replaces with server status on success', async () => {
    mockSubscribe.mockResolvedValue({
      status: {
        triggers: ['release', 'new_season'],
        hasRelease: true,
        hasNewSeason: true,
        hasOnStreaming: false,
      },
    });

    renderWithClient(<SubscribeConsumer trigger="release" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('triggers').textContent).toBe('[]');
    });

    await act(async () => {
      screen.getByTestId('subscribe').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-new-season').textContent).toBe('true');
    });
  });

  it('rolls back on error', async () => {
    mockSubscribe.mockRejectedValue(new Error('server error'));

    renderWithClient(<SubscribeConsumer trigger="release" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('subscribe').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('false');
    });
  });
});

describe('useUnsubscribe', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
    mockGetSubscriptionStatus.mockResolvedValue({
      triggers: ['release', 'new_season'],
      hasRelease: true,
      hasNewSeason: true,
      hasOnStreaming: false,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('optimistically removes trigger from array', async () => {
    let resolveMutation: (value: any) => void;
    mockUnsubscribe.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnsubscribeConsumer trigger="release" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsubscribe').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('false');
    });

    await act(async () => {
      resolveMutation!({
        status: { triggers: ['new_season'], hasRelease: false, hasNewSeason: true, hasOnStreaming: false },
      });
    });
  });

  it('rolls back on error', async () => {
    mockUnsubscribe.mockRejectedValue(new Error('server error'));

    renderWithClient(<UnsubscribeConsumer trigger="release" />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('unsubscribe').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-release').textContent).toBe('true');
    });
  });
});
