import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@heroui/react/toast';
import { useAuth } from '@ratingo/web-core/auth';
import {
  calendarApi,
  episodeProgressApi,
  libraryApi,
  type CalendarEpisode,
  type CalendarRange,
  type UserMediaState,
} from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { calendarEpisode, calendarMovie, calendarRange } from '../model/calendar-episode.fixture';
import { CalendarView } from './calendar-view';

jest.mock('next/navigation', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react');
  const listeners = new Set<() => void>();
  const replaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args: Parameters<History['replaceState']>) => {
    replaceState(...args);
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});
jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: jest.fn(),
  tokenStorage: { getRefreshToken: () => 'refresh-token' },
}));
jest.mock('@/shared/api', () => ({
  calendarApi: { getRange: jest.fn() },
  fetchAllPages: jest.fn().mockResolvedValue([]),
  subscriptionsApi: { list: jest.fn() },
  episodeProgressApi: { markWatched: jest.fn(), markUnwatched: jest.fn() },
  libraryApi: { startWatching: jest.fn() },
}));

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const TODAY = '2026-11-12';

function episode(overrides: Partial<CalendarEpisode>): CalendarEpisode {
  return calendarEpisode({
    seasonNumber: 2,
    episodeNumber: 4,
    airDate: '2026-11-12T08:00:00.000Z',
    ...overrides,
  });
}

function range(episodes: CalendarEpisode[], watchingShowsCount?: number): CalendarRange {
  return calendarRange(episodes, watchingShowsCount);
}

const AIRED_TRACKED = episode({
  episodeId: 'aired',
  showId: 'pingvin',
  showTitle: 'Пінгвін',
  isTracked: true,
});
const FUTURE_TRACKED = episode({
  episodeId: 'future',
  showId: 'pingvin',
  showTitle: 'Пінгвін',
  episodeNumber: 5,
  airDate: '2026-11-14T19:00:00.000Z',
  isTracked: true,
});
const OTHER_SHOW = episode({ episodeId: 'other', showId: 'other', showTitle: 'Сімпсони' });

function signIn(user: { id: string } | null) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ user, isAuthenticated: user !== null, isLoading: false } as ReturnType<
      typeof useAuth
    >);
}

function renderCalendar(everyone?: CalendarRange) {
  if (everyone) jest.mocked(calendarApi.getRange).mockResolvedValue(everyone);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <CalendarView today={TODAY} />
        <ToastProvider />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('CalendarView', () => {
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    window.history.replaceState(null, '', '/calendar');
    jest.mocked(calendarApi.getRange).mockResolvedValue(range([]));
    jest.mocked(episodeProgressApi.markWatched).mockResolvedValue();
    jest.mocked(episodeProgressApi.markUnwatched).mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows all shows to guests with a start-watching action', async () => {
    signIn(null);
    renderCalendar(range([OTHER_SHOW]));

    expect(await screen.findByText('Сімпсони')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Усі' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Почати дивитись: Сімпсони' })).toBeInTheDocument();
    expect(calendarApi.getRange).toHaveBeenCalledWith({
      startDate: '2026-11-08',
      days: 8,
      personalized: false,
      type: 'show',
    });
  });

  it('switches to movie premieres with their kind and the count of the rest', async () => {
    signIn(null);
    const movieDay = {
      date: '2026-11-13',
      episodes: [],
      movies: [
        calendarMovie({
          mediaItemId: 'dune',
          title: 'Дюна',
          releaseCountry: null,
          releaseDate: '2026-11-13T00:00:00.000Z',
        }),
      ],
      moreMoviesCount: 3,
    };
    const releasedDay = {
      date: '2026-11-11',
      episodes: [],
      movies: [calendarMovie({ title: 'Аврора', releaseDate: '2026-11-11T00:00:00.000Z' })],
    };
    jest
      .mocked(calendarApi.getRange)
      .mockImplementation(async ({ type }) =>
        type === 'movie' ? { ...range([]), days: [releasedDay, movieDay] } : range([OTHER_SHOW]),
      );
    const gtag = jest.fn();
    window.gtag = gtag;
    renderCalendar();
    await screen.findByText('Сімпсони');

    fireEvent.click(screen.getByRole('link', { name: 'Фільми' }));

    expect(gtag).toHaveBeenCalledWith('event', 'calendar_change', {
      action: 'type',
      media_type: 'movie',
    });
    delete window.gtag;

    expect(await screen.findByText('Дюна')).toBeInTheDocument();
    expect(screen.getAllByText('в кіно')).toHaveLength(2);
    expect(screen.getByText('Ще 3 фільми цього дня')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зберегти «Дюна»' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Нагадати про вихід: Дюна' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Аврора')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Зберегти «Аврора»' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Фільми' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.search).toBe('?type=movie');
    expect(calendarApi.getRange).toHaveBeenCalledWith(
      expect.objectContaining({ personalized: false, type: 'movie' }),
    );
  });

  it('invites guests who pick “Mine” to sign in', async () => {
    signIn(null);
    renderCalendar(range([OTHER_SHOW]));

    fireEvent.click((await screen.findAllByRole('button', { name: 'Мої' }))[0]);

    expect(await screen.findByText('Тут будуть твої серіали')).toBeInTheDocument();
    expect(window.location.search).toBe('?mode=mine');
    fireEvent.click(screen.getByRole('button', { name: 'Показати всі' }));
    expect(await screen.findByText('Сімпсони')).toBeInTheDocument();
  });

  it('opens on “Mine” for viewers who track shows and marks aired episodes', async () => {
    signIn({ id: 'user' });
    jest.mocked(calendarApi.getRange).mockResolvedValue(range([AIRED_TRACKED, FUTURE_TRACKED], 1));
    renderCalendar();

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Позначити переглянутою: Пінгвін\u00a0С2 · Е4',
    });
    expect(screen.getAllByRole('button', { name: 'Мої' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);

    fireEvent.click(checkbox);

    await waitFor(() => expect(episodeProgressApi.markWatched).toHaveBeenCalledWith('aired'));
    expect(checkbox).toBeChecked();
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }));
    await waitFor(() => expect(episodeProgressApi.markUnwatched).toHaveBeenCalledWith('aired'));
  });

  it('starts watching a show from “All”', async () => {
    signIn({ id: 'user' });
    jest.mocked(calendarApi.getRange).mockResolvedValue(range([OTHER_SHOW], 0));
    jest
      .mocked(libraryApi.startWatching)
      .mockResolvedValue({ mediaItemId: 'other', state: 'watching' } as UserMediaState);
    renderCalendar();

    fireEvent.click(await screen.findByRole('button', { name: 'Почати дивитись: Сімпсони' }));

    await waitFor(() => expect(libraryApi.startWatching).toHaveBeenCalledWith('other'));
  });

  it('tells trackers when their shows rest this week', async () => {
    signIn({ id: 'user' });
    const nextEpisode = episode({ showTitle: 'Андор', airDate: '2026-11-20T19:00:00.000Z' });
    jest
      .mocked(calendarApi.getRange)
      .mockImplementation(async ({ startDate }) =>
        startDate === '2026-11-15' ? range([nextEpisode], 1) : range([], 1),
      );
    renderCalendar();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Мої' }))[0]);

    expect(await screen.findByText('Цього тижня твої серіали відпочивають')).toBeInTheDocument();
    expect(await screen.findByText(/Андор С2 · Е4, 20 листопада/)).toBeInTheDocument();
  });

  it('moves to the next week and back to today', async () => {
    signIn(null);
    jest.mocked(calendarApi.getRange).mockResolvedValue(range([]));
    renderCalendar(range([OTHER_SHOW]));

    fireEvent.click(await screen.findByRole('button', { name: 'Наступний тиждень' }));

    expect(await screen.findByRole('heading', { name: 'Наступний тиждень' })).toBeInTheDocument();
    expect(screen.getByText('16–22 листопада')).toBeInTheDocument();
    expect(window.location.search).toBe('?week=2026-11-16&mode=all');
    fireEvent.click(screen.getAllByRole('button', { name: 'Сьогодні' })[0]);
    expect(await screen.findByRole('heading', { name: 'Цей тиждень' })).toBeInTheDocument();
  });

  it('keeps the chosen mode when stepping to another week', async () => {
    signIn({ id: 'user' });
    jest.mocked(calendarApi.getRange).mockResolvedValue(range([AIRED_TRACKED], 1));
    renderCalendar();

    await screen.findByRole('checkbox');
    fireEvent.click(screen.getByRole('button', { name: 'Наступний тиждень' }));

    expect(screen.getAllByRole('button', { name: 'Мої' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.location.search).toBe('?week=2026-11-16&mode=mine');
  });

  it('expands and collapses the less popular shows of a day', async () => {
    signIn(null);
    const shows = ['a', 'b', 'c', 'd', 'e'].map((showId, index) =>
      episode({ showId, showTitle: `Серіал ${showId}`, showPopularity: 100 - index }),
    );
    renderCalendar(range(shows));

    const more = await screen.findByRole('button', { name: 'Ще 2 серіали за популярністю' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Серіал e')).not.toBeInTheDocument();

    fireEvent.click(more);

    expect(screen.getByText('Серіал e')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Згорнути' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('opens the week the address points to', async () => {
    signIn(null);
    window.history.replaceState(null, '', '/calendar?week=2026-11-16&mode=all');
    renderCalendar();

    expect(await screen.findByRole('heading', { name: 'Наступний тиждень' })).toBeInTheDocument();
  });
});
