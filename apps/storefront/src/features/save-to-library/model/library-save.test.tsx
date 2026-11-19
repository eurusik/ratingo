import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CALENDAR_QUERY_KEY } from '@/entities/episode';
import { remindersKey } from '@/entities/subscription';
import { libraryApi } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { useLibrarySave } from './library-save';

jest.mock('@/shared/api', () => ({
  libraryApi: { getSaveStatuses: jest.fn(), save: jest.fn(), unsave: jest.fn() },
}));

const DUNE = { mediaItemId: 'dune-id', title: 'Дюна' };
const REMINDERS = remindersKey('user-id');
const CALENDAR = [...CALENDAR_QUERY_KEY, 'week'];

function renderWithReminders() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(REMINDERS, []);
  queryClient.setQueryData(CALENDAR, []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useLibrarySave(), { wrapper });
  const remindersStale = () => queryClient.getQueryState(REMINDERS)?.isInvalidated;
  const settled = () => queryClient.isMutating() === 0;
  const calendarStale = () => queryClient.getQueryState(CALENDAR)?.isInvalidated;
  const markRemindersFresh = () => queryClient.setQueryData(REMINDERS, []);
  return { result, remindersStale, calendarStale, settled, markRemindersFresh };
}

describe('useLibrarySave reminders', () => {
  afterEach(() => jest.clearAllMocks());

  it('refreshes reminders once a title lands in for later, since the API subscribes to its release', async () => {
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({});
    jest.mocked(libraryApi.save).mockResolvedValue({ isForLater: true, isConsidering: false });
    const { result, remindersStale, calendarStale } = renderWithReminders();

    act(() => result.current.save(DUNE));

    await waitFor(() => expect(remindersStale()).toBe(true));
    expect(calendarStale()).toBe(true);
  });

  it('refreshes reminders once a title leaves for later, since the API drops its automatic ones', async () => {
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({});
    jest.mocked(libraryApi.save).mockResolvedValue({ isForLater: true, isConsidering: false });
    jest.mocked(libraryApi.unsave).mockResolvedValue({ isForLater: false, isConsidering: false });
    const { result, remindersStale, settled, markRemindersFresh } = renderWithReminders();
    act(() => result.current.save(DUNE));
    await waitFor(() => expect(settled()).toBe(true));
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({
      [DUNE.mediaItemId]: { isForLater: true, isConsidering: false },
    });
    markRemindersFresh();

    act(() => result.current.removeIfSaved(DUNE, 'removed'));

    await waitFor(() => expect(libraryApi.unsave).toHaveBeenCalled());
    await waitFor(() => expect(remindersStale()).toBe(true));
  });

  it('leaves reminders alone when the title was already for later', async () => {
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({
      [DUNE.mediaItemId]: { isForLater: true, isConsidering: false },
    });
    const { result, remindersStale, settled } = renderWithReminders();

    act(() => result.current.save(DUNE));

    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());
    await waitFor(() => expect(settled()).toBe(true));
    expect(libraryApi.save).not.toHaveBeenCalled();
    expect(remindersStale()).toBe(false);
  });
});
