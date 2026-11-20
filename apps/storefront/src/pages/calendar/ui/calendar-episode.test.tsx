import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { calendarEpisode } from '../model/calendar-episode.fixture';
import { CalendarProvider } from './calendar-context';
import { CalendarEpisodeItem } from './calendar-episode';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  libraryApi: { getSaveStatuses: jest.fn().mockResolvedValue({}) },
}));

const NOW = Date.parse('2026-11-12T12:00:00.000Z');

function renderRow(episode: ReturnType<typeof calendarEpisode>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const calendar = {
    mode: 'all',
    viewer: 'signedIn',
    now: NOW,
    start: jest.fn(),
  } as unknown as Parameters<typeof CalendarProvider>[0]['value'];
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <CalendarProvider value={calendar}>
          <ul>
            <CalendarEpisodeItem episode={episode} />
          </ul>
        </CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('CalendarEpisodeItem', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('offers to save a show whose premiere is still ahead', () => {
    renderRow(
      calendarEpisode({
        showTitle: 'Новий серіал',
        seasonNumber: 1,
        episodeNumber: 1,
        airDate: '2026-11-14T19:00:00.000Z',
      }),
    );

    expect(screen.getByRole('button', { name: 'Зберегти «Новий серіал»' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Почати/ })).not.toBeInTheDocument();
  });

  it('offers to start a show that is already airing', () => {
    renderRow(calendarEpisode({ showTitle: 'Сьоґун', seasonNumber: 2, episodeNumber: 3 }));

    expect(screen.getByRole('button', { name: 'Почати дивитись: Сьоґун' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Зберегти/ })).not.toBeInTheDocument();
  });
});
