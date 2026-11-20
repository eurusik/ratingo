import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import type { TrendingMedia } from '@/entities/media';
import { openSearch } from '@/features/search';
import { openAuth } from '@/shared/auth';
import { I18nProvider, getDictionary, type Locale } from '@/shared/i18n';
import { loadReleaseList, loadTrendingList } from '../api/home-rails';
import type { EpisodeRelease, PremiereRelease, UpcomingRelease } from '../model/home-feed';
import { RELEASE_LISTS, TOP_TEN_LISTS, startRail } from '../model/rail-start';
import { AnticipatedPremieres } from './anticipated-premieres';
import { HeroBanner } from './hero-banner';
import { HomeOutage } from './home-outage';
import { HomeSectionError } from './home-section-error';
import { NewEpisodes } from './new-episodes';
import { NewReleases } from './new-releases';
import { TopTen } from './top-ten';
import { TopThree } from './top-three';
import { TrackShowsCard } from './track-shows-card';
import { UpcomingMovies } from './upcoming-movies';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/search', () => ({ openSearch: jest.fn() }));
jest.mock('@/shared/auth', () => ({
  ...jest.requireActual('@/shared/auth'),
  openAuth: jest.fn(),
}));
jest.mock('../api/home-rails', () => ({ loadTrendingList: jest.fn(), loadReleaseList: jest.fn() }));
jest.mock('@/shared/api', () => ({
  libraryApi: { getSaveStatuses: jest.fn(), getRatings: jest.fn() },
}));

const uk = getDictionary('uk');

function media(id: string, type: TrendingMedia['type'], extra?: Partial<TrendingMedia>) {
  return { mediaItemId: id, type, slug: id, title: id, providers: [], ...extra };
}

const ANDOR = media('Андор', 'show', { verdict: 'good', watchingNow: 340 });
const DUNE = media('Дюна', 'movie');
const BARBIE = media('Барбі', 'movie');

function topTen(shows: TrendingMedia[], movies: TrendingMedia[]) {
  return startRail({ show: shows, movie: movies }, TOP_TEN_LISTS);
}

function newReleases(nowPlaying: TrendingMedia[], newOnDigital: TrendingMedia[]) {
  return startRail({ nowPlaying, newOnDigital }, RELEASE_LISTS);
}

function renderIn(ui: ReactNode, locale: Locale = 'uk') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
        {ui}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    user: null,
    isLoading: false,
    isAuthenticated: false,
  } as unknown as ReturnType<typeof useAuth>);
});

describe('TopTen', () => {
  it('ranks shows first and fetches movies when switched to them', async () => {
    jest.mocked(loadTrendingList).mockResolvedValue([DUNE, BARBIE]);
    renderIn(<TopTen rail={topTen([ANDOR], [DUNE, BARBIE])} />);

    const shows = screen.getByRole('list', { name: uk.home.topTen });
    expect(within(shows).getAllByRole('listitem')).toHaveLength(1);
    expect(within(shows).getByRole('link', { name: /Андор/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.home.typeFilter.movie }));

    const movies = await screen.findByRole('list', { name: uk.home.topTen });
    expect(loadTrendingList).toHaveBeenCalledWith('movie');
    expect(movies.tagName).toBe('OL');
    expect(within(movies).getAllByRole('listitem')).toHaveLength(2);
    expect(within(movies).getByRole('link', { name: /Дюна/ })).toHaveAttribute(
      'href',
      '/movies/%D0%94%D1%8E%D0%BD%D0%B0',
    );
  });

  it('shows the only type that loaded, without a filter', () => {
    renderIn(<TopTen rail={topTen([], [DUNE])} />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Дюна/ })).toBeInTheDocument();
  });

  it('renders nothing when nothing is ranked', () => {
    const { container } = renderIn(<TopTen rail={topTen([], [])} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('NewReleases', () => {
  it('opens on cinemas with a save control and switches to streaming', async () => {
    jest.mocked(loadReleaseList).mockResolvedValue([BARBIE]);
    renderIn(<NewReleases rail={newReleases([DUNE], [BARBIE])} />);

    const cinemas = screen.getByRole('list', { name: uk.home.newReleases });
    expect(within(cinemas).getByRole('button', { name: 'Зберегти «Дюна»' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    const streaming = await screen.findByRole('list', { name: uk.home.newReleases });
    expect(within(streaming).getByRole('link', { name: 'Барбі' })).toBeInTheDocument();
    expect(within(streaming).queryByRole('link', { name: 'Дюна' })).not.toBeInTheDocument();
  });

  it('shows a skeleton row, not an empty rail, while the other list loads', async () => {
    let finish: (items: TrendingMedia[]) => void = () => {};
    jest.mocked(loadReleaseList).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderIn(<NewReleases rail={newReleases([DUNE], [BARBIE])} />);

    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    expect(screen.queryByRole('list', { name: uk.home.newReleases })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: uk.home.newReleases })).toBeInTheDocument();
    finish([BARBIE]);
    expect(await screen.findByRole('link', { name: 'Барбі' })).toBeInTheDocument();
  });

  it('offers a retry instead of an endless skeleton when the other list fails', async () => {
    jest.mocked(loadReleaseList).mockRejectedValueOnce(new Error('offline'));
    renderIn(<NewReleases rail={newReleases([DUNE], [BARBIE])} />);

    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));
    jest.mocked(loadReleaseList).mockResolvedValue([BARBIE]);
    fireEvent.click(await screen.findByRole('button', { name: uk.common.retry }));

    expect(await screen.findByRole('link', { name: 'Барбі' })).toBeInTheDocument();
  });

  it('starts loading the other list as soon as the filter is touched', () => {
    jest.mocked(loadReleaseList).mockResolvedValue([BARBIE]);
    renderIn(<NewReleases rail={newReleases([DUNE], [BARBIE])} />);

    fireEvent.pointerDown(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    expect(loadReleaseList).toHaveBeenCalledWith('newOnDigital');
  });

  it('falls back to the list that still has titles after a refresh', () => {
    jest.mocked(loadReleaseList).mockResolvedValue([BARBIE]);
    const { rerender } = renderIn(<NewReleases rail={newReleases([DUNE], [BARBIE])} />);
    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="uk" dictionary={uk}>
          <NewReleases rail={newReleases([DUNE], [])} />
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Дюна' })).toBeInTheDocument();
  });
});

describe('HeroBanner', () => {
  it('names the lead as number one and keeps its ratings next to the verdict', () => {
    renderIn(<HeroBanner hero={{ ...ANDOR, imdbRating: 8.3 }} />, 'en');

    expect(screen.getByRole('heading', { name: 'No. 1 right now: Андор' })).toBeInTheDocument();
    expect(screen.getByText('8.3')).toBeInTheDocument();
  });
});

describe('TopThree', () => {
  it('continues the ranking after the lead and says how many people are watching', () => {
    renderIn(<TopThree items={[ANDOR, DUNE]} firstRank={2} />, 'en');

    const list = screen.getByRole('list', { name: 'Also on top' });
    expect(list.tagName).toBe('OL');
    expect(list).toHaveAttribute('start', '2');
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('2Андор');
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Show · 340 watching');
  });
  it('says in words how many people are watching, with the Ukrainian plural', () => {
    renderIn(<TopThree items={[{ ...ANDOR, year: 2022, watchingNow: 31 }]} firstRank={2} />);

    expect(screen.getByRole('listitem')).toHaveTextContent('Серіал · 2022 · 31 дивиться');
  });
});

describe('NewEpisodes', () => {
  const release: EpisodeRelease = {
    mediaItemId: 'law',
    slug: 'law',
    showTitle: 'Закон і порядок',
    episodeTitle: 'Do No Harm',
    season: 26,
    episode: 6,
    airedAt: '2026-11-12T23:30:00Z',
  };

  it('shows the episode number and the Kyiv air date', () => {
    renderIn(<NewEpisodes releases={[release]} />);

    const link = screen.getByRole('link', { name: /Закон і порядок/ });
    expect(link).toHaveAttribute('href', '/shows/law');
    expect(link).toHaveTextContent('С26 · Е6');
    expect(link).toHaveTextContent('Сезон 26, серія 6');
    expect(within(link).getByText(/13 лист/)).toHaveAttribute('dateTime', release.airedAt);
  });
});

describe('below-the-fold sections', () => {
  it('let the browser skip rendering new episodes, new releases and the sign-in card off screen', () => {
    const release: EpisodeRelease = {
      mediaItemId: 'law',
      slug: 'law',
      showTitle: 'Закон і порядок',
      episodeTitle: 'Do No Harm',
      season: 26,
      episode: 6,
      airedAt: '2026-11-12T23:30:00Z',
    };
    renderIn(
      <>
        <NewEpisodes releases={[release]} />
        <NewReleases rail={newReleases([DUNE], [])} />
        <TrackShowsCard />
      </>,
    );

    for (const name of [uk.home.newEpisodes, uk.home.newReleases, uk.home.track.title]) {
      expect(screen.getByRole('region', { name })).toHaveClass('below-fold');
    }
  });
});

describe('TrackShowsCard', () => {
  it('invites a guest to sign in or find a show', () => {
    renderIn(<TrackShowsCard />);

    fireEvent.click(screen.getByRole('button', { name: uk.home.track.signIn }));
    expect(openAuth).toHaveBeenCalledWith({ mode: 'login' });

    fireEvent.click(screen.getByRole('button', { name: uk.home.track.find }));
    expect(openSearch).toHaveBeenCalled();
  });

  it('stays hidden for a signed-in user and while the session loads', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'u1' },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);
    const { container, rerender } = renderIn(<TrackShowsCard />);
    expect(container).toBeEmptyDOMElement();

    jest.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useAuth>);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="uk" dictionary={uk}>
          <TrackShowsCard />
        </I18nProvider>
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('HomeSectionError', () => {
  it('keeps the section heading and reloads the server data on retry', () => {
    renderIn(<HomeSectionError section="topTen" />);

    expect(screen.getByRole('heading', { name: uk.home.topTen })).toBeInTheDocument();
    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent(uk.home.failed.topTen);
    expect(alert).toHaveTextContent(uk.common.sectionErrorHint);
    fireEvent.click(within(alert).getByRole('button', { name: uk.common.retry }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe('HomeOutage', () => {
  it('offers to retry or open My when the whole feed is down', () => {
    renderIn(<HomeOutage />);

    expect(screen.getByRole('heading', { name: uk.home.outage.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.home.outage.openMy })).toHaveAttribute(
      'href',
      '/my',
    );
    fireEvent.click(screen.getByRole('button', { name: uk.common.retry }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe('AnticipatedPremieres', () => {
  const premiere: PremiereRelease = {
    mediaItemId: 'hp',
    slug: 'harry-potter',
    title: 'Гаррі Поттер',
    posterUrl: 'https://image.tmdb.org/t/p/w342/hp.jpg',
    premiereDate: '2026-12-25T00:00:00.000Z',
  };

  it('shows the premiere day and links to the show and the show calendar', () => {
    renderIn(<AnticipatedPremieres premieres={[premiere]} />);

    expect(screen.getByRole('heading', { name: uk.home.premieres })).toBeInTheDocument();
    expect(screen.getByText('25 груд')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Гаррі Поттер/ })).toHaveAttribute(
      'href',
      '/shows/harry-potter',
    );
    expect(screen.getByRole('link', { name: uk.home.calendarLabel.show })).toHaveAttribute(
      'href',
      '/calendar',
    );
  });

  it('reports opening a show and the show calendar', () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    renderIn(<AnticipatedPremieres premieres={[premiere]} />);

    fireEvent.click(screen.getByRole('link', { name: /Гаррі Поттер/ }), { metaKey: true });
    fireEvent.click(screen.getByRole('link', { name: uk.home.calendarLabel.show }), {
      metaKey: true,
    });

    expect(gtag).toHaveBeenCalledWith('event', 'open_title', {
      origin: 'home_premieres',
      media_type: 'show',
      in_catalog: 'true',
      position: 1,
    });
    expect(gtag).toHaveBeenCalledWith('event', 'calendar_open', { origin: 'home_premieres' });
    delete window.gtag;
  });

  it('renders nothing without premieres', () => {
    const { container } = renderIn(<AnticipatedPremieres premieres={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('UpcomingMovies', () => {
  const release: UpcomingRelease = {
    mediaItemId: 'doom',
    slug: 'doom',
    title: 'Месники: Сходження Доктора Дума',
    releaseDate: '2026-12-18T00:00:00.000Z',
    kind: 'theatrical',
  };

  it('shows the release day, the kind and a link to the movie calendar', () => {
    renderIn(<UpcomingMovies releases={[release]} />);

    expect(screen.getByRole('heading', { name: 'Скоро в прокаті' })).toBeInTheDocument();
    expect(screen.getByText('18 груд')).toBeInTheDocument();
    expect(screen.getByText('в кіно')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Календар фільмів' })).toHaveAttribute(
      'href',
      '/calendar?type=movie',
    );
  });

  it('reports opening a movie and the movie calendar', () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    renderIn(<UpcomingMovies releases={[release]} />);

    fireEvent.click(screen.getByRole('link', { name: /Месники/ }), { metaKey: true });
    fireEvent.click(screen.getByRole('link', { name: 'Календар фільмів' }), { metaKey: true });

    expect(gtag).toHaveBeenCalledWith('event', 'open_title', {
      origin: 'home_upcoming',
      media_type: 'movie',
      in_catalog: 'true',
      position: 1,
    });
    expect(gtag).toHaveBeenCalledWith('event', 'calendar_open', { origin: 'home_upcoming' });
    delete window.gtag;
  });

  it('saves a movie from its poster without leaving the rail', () => {
    renderIn(<UpcomingMovies releases={[release]} />);

    const save = screen.getByRole('button', { name: `Зберегти «${release.title}»` });
    expect(save.closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: /Месники/ })).toHaveAttribute('href', '/movies/doom');
  });

  it('hides the rail when nothing is coming', () => {
    const { container } = renderIn(<UpcomingMovies releases={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('opening a title from the home page', () => {
  const episode: EpisodeRelease = {
    mediaItemId: 'law',
    slug: 'law',
    showTitle: 'Закон і порядок',
    episodeTitle: 'Do No Harm',
    season: 26,
    episode: 6,
    airedAt: '2026-11-12T23:30:00Z',
  };

  afterEach(() => {
    delete window.gtag;
  });

  it.each([
    [
      'home_hero',
      <HeroBanner key="hero" hero={ANDOR} />,
      /Андор/,
      { media_type: 'show', position: 1 },
    ],
    [
      'home_top_picks',
      <TopThree key="picks" items={[ANDOR, DUNE]} firstRank={2} />,
      /Дюна/,
      { media_type: 'movie', position: 3 },
    ],
    [
      'home_top_ten',
      <TopTen key="top" rail={topTen([], [BARBIE, DUNE])} />,
      /Дюна/,
      { media_type: 'movie', position: 2 },
    ],
    [
      'home_episodes',
      <NewEpisodes key="episodes" releases={[episode]} />,
      /Закон/,
      { media_type: 'show', position: 1 },
    ],
    [
      'home_releases',
      <NewReleases key="releases" rail={newReleases([], [BARBIE, DUNE])} />,
      /Дюна/,
      { media_type: 'movie', position: 2, list: 'newOnDigital' },
    ],
  ])('reports the block %s and the place of the opened title', (origin, block, link, details) => {
    const gtag = jest.fn();
    window.gtag = gtag;
    renderIn(block);

    fireEvent.click(screen.getByRole('link', { name: link }), { metaKey: true });

    expect(gtag).toHaveBeenCalledWith('event', 'open_title', {
      origin,
      in_catalog: 'true',
      ...details,
    });
  });

  it('reports switching a rail to another list', () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    jest.mocked(loadTrendingList).mockResolvedValue([DUNE]);
    renderIn(<TopTen rail={topTen([ANDOR], [DUNE])} />);

    const other = screen.getByRole('radio', { checked: false });
    fireEvent.click(other);

    const list = other.textContent === uk.home.typeFilter.movie ? 'movie' : 'show';
    expect(gtag).toHaveBeenCalledWith('event', 'home_rail_change', { section: 'top-ten', list });
  });
});
