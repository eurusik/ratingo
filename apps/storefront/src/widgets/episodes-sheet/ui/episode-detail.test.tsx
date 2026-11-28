import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Episode, Season } from '@/entities/episode';
import { catalogApi, type EpisodeOverview } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';
import { EpisodeDetail } from './episode-detail';

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  catalogApi: { getSeasonOverviews: jest.fn() },
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const NOW = Date.parse('2026-11-28T12:00:00.000Z');
const aired = (number: number, title: string): Episode => ({
  id: `e${number}`,
  seasonNumber: 1,
  number,
  title,
  airDate: `2026-11-0${number}T20:00:00.000Z`,
  runtimeMinutes: 58,
});
const RETURN = aired(1, 'Повернення');
const TRACKS = aired(2, 'Сліди на піску');
const LIGHTHOUSE = aired(3, 'Маяк');
const SEASONS: Season[] = [{ number: 1, episodes: [RETURN, TRACKS, LIGHTHOUSE] }];

function overviews(...items: EpisodeOverview[]) {
  jest.mocked(catalogApi.getSeasonOverviews).mockResolvedValue(items);
}

function renderDetail(
  episode: Episode,
  tracker: Partial<EpisodesTracker> = {},
  layout: 'page' | 'pane' = 'page',
) {
  const callbacks = { onOpen: jest.fn(), onBack: jest.fn(), onClose: jest.fn() };
  const fullTracker = {
    now: NOW,
    watched: new Set<string>(),
    summary: { watched: 0, aired: 3, next: RETURN },
    toggle: jest.fn(),
    ...tracker,
  } as unknown as EpisodesTracker;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <EpisodeDetail
          layout={layout}
          showSlug="quiet-shore"
          seasons={SEASONS}
          episode={episode}
          tracker={fullTracker}
          {...callbacks}
        />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...callbacks, tracker: fullTracker };
}

describe('EpisodeDetail', () => {
  it('beside the list it closes only itself and offers no way back to the season', () => {
    overviews();
    const { onBack, onClose } = renderDetail(TRACKS, {}, 'pane');

    expect(screen.queryByRole('button', { name: 'Сезон 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрити опис' }));
    expect(onBack).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the Ukrainian overview of the season it loads by show and season', async () => {
    overviews({ number: 2, overview: 'Ліна знаходить сліди на піску.', isUkrainian: true });
    renderDetail(TRACKS);

    expect(await screen.findByText('Ліна знаходить сліди на піску.')).toBeInTheDocument();
    expect(catalogApi.getSeasonOverviews).toHaveBeenCalledWith('quiet-shore', 1, expect.anything());
    expect(screen.getByRole('heading', { name: 'Сліди на піску' })).toHaveFocus();
    expect(screen.queryByText(/Українського опису ще нема/)).not.toBeInTheDocument();
  });

  it('labels an overview that is not in Ukrainian', async () => {
    overviews({ number: 2, overview: 'Lina finds footprints.', isUkrainian: false });
    renderDetail(TRACKS);

    expect(await screen.findByText('Lina finds footprints.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText(/Українського опису ще нема/)).toBeInTheDocument();
  });

  it('covers the overview of an episode past the next one until the viewer asks', async () => {
    overviews({ number: 3, overview: 'Пором не приходить.', isUkrainian: true });
    renderDetail(LIGHTHOUSE, {
      watched: new Set(['e1']),
      summary: { watched: 1, aired: 3, next: TRACKS as never },
    });

    const reveal = await screen.findByRole('button', { name: 'Спойлер · показати' });
    expect(screen.getByText('Ти ще не дивився С1 · Е2, тому опис сховали')).toBeInTheDocument();

    fireEvent.click(reveal);
    expect(screen.getByText('Пором не приходить.')).not.toHaveAttribute('aria-hidden');
  });

  it('marks the episode watched and moves to the neighbouring episodes', async () => {
    overviews();
    const { tracker, onOpen, onBack } = renderDetail(TRACKS);

    fireEvent.click(screen.getByRole('button', { name: 'Позначити переглянутою' }));
    expect(tracker.toggle).toHaveBeenCalledWith(TRACKS, true);

    fireEvent.click(screen.getByRole('button', { name: 'Наступна серія, С1 · Е3: Маяк' }));
    expect(onOpen).toHaveBeenCalledWith(LIGHTHOUSE);
    fireEvent.click(screen.getByRole('button', { name: 'Попередня серія, С1 · Е1: Повернення' }));
    expect(onOpen).toHaveBeenCalledWith(RETURN);

    fireEvent.click(screen.getByRole('button', { name: 'Сезон 1' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('says the description failed to load instead of showing nothing', async () => {
    jest.mocked(catalogApi.getSeasonOverviews).mockRejectedValue(new Error('down'));
    renderDetail(TRACKS);

    expect(await screen.findByText(/Не вдалося завантажити опис/)).toBeInTheDocument();
  });

  it('shows the undo notice after marking several episodes at once', () => {
    overviews();
    renderDetail(TRACKS, {
      notice: { id: 1, message: 'Позначили 2 серії', undo: { episodeIds: [], watched: false } },
      holdNotice: jest.fn(),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Позначили 2 серії');
  });

  it('offers no marking for an episode that has not aired', () => {
    overviews();
    renderDetail({ ...LIGHTHOUSE, airDate: '2026-12-05T20:00:00.000Z' });

    expect(
      screen.queryByRole('button', { name: 'Позначити переглянутою' }),
    ).not.toBeInTheDocument();
  });
});
