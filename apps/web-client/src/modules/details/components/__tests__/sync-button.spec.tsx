import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SyncButton } from '../sync-button';

type SyncResult = { queued: boolean; cooldownExpiresAt?: string };
type MutateOptions = { onSuccess: (result: SyncResult) => void; onError: () => void };

const mockMutate = jest.fn<void, [undefined, MutateOptions]>();

jest.mock('@/modules/details/hooks/use-show-sync', () => ({
  useShowSync: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/core/auth/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('@/core/auth/auth-modal.store', () => ({
  useAuthModalStore: () => jest.fn(),
}));

jest.mock('@/shared/i18n', () => ({
  useLocale: () => 'en',
  useTranslation: () => ({
    dict: {
      details: {
        sync: {
          button: 'Sync metadata',
          lastSynced: 'Synced {time}',
          neverSynced: 'Never synced',
          cooldown: 'Next sync available {date}',
          autoSyncOff: 'Auto-sync disabled',
          tooltipDescription: 'Updates metadata',
          tooltipLastSync: 'Last synced: {date}',
          tooltipNeverSync: 'Never synced',
          tooltipCooldown: 'Available once every 7 days',
          error: 'Sync failed',
        },
      },
    },
  }),
}));

jest.mock('@/shared/utils/format', () => ({
  formatRelativeDate: (date: string) => ({ text: date }),
}));

jest.mock('@/shared/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const SLUG = 'severance';
const STORAGE_KEY = `ratingo:sync-queued:${SLUG}`;
const NOW = new Date('2026-11-09T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function syncButton() {
  return screen.getByRole('button', { name: 'Sync metadata' });
}

describe('SyncButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockMutate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('is enabled when the show was never synced', () => {
    render(<SyncButton slug={SLUG} lastSyncedAt={null} />);

    expect(syncButton()).toBeEnabled();
    expect(screen.getByText('Never synced')).toBeInTheDocument();
  });

  it('stays on cooldown while a sync queued in the last 7 days is stored', () => {
    localStorage.setItem(STORAGE_KEY, new Date(NOW.getTime() - DAY_MS).toISOString());

    render(<SyncButton slug={SLUG} lastSyncedAt={null} />);

    expect(syncButton()).toBeDisabled();
  });

  it('forgets a stored queue time older than 7 days', () => {
    localStorage.setItem(STORAGE_KEY, new Date(NOW.getTime() - 8 * DAY_MS).toISOString());

    render(<SyncButton slug={SLUG} lastSyncedAt={null} />);

    expect(syncButton()).toBeEnabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('unlocks by itself when the server cooldown expires', () => {
    const cooldownExpiresAt = new Date(NOW.getTime() + 60_000).toISOString();
    mockMutate.mockImplementation((_variables, options) => {
      options.onSuccess({ queued: false, cooldownExpiresAt });
    });

    render(<SyncButton slug={SLUG} lastSyncedAt={null} />);
    fireEvent.click(syncButton());

    expect(syncButton()).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(syncButton()).toBeEnabled();
  });

  it('stores the queue time and locks the button after a successful sync', () => {
    mockMutate.mockImplementation((_variables, options) => {
      options.onSuccess({ queued: true });
    });

    render(<SyncButton slug={SLUG} lastSyncedAt={null} />);
    fireEvent.click(syncButton());

    expect(syncButton()).toBeDisabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(NOW.toISOString());
  });
});
