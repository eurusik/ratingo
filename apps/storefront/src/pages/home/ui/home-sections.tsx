import type { MediaType } from '@/shared/api';
import { getDictionary, type Locale } from '@/shared/i18n';
import {
  loadHero,
  loadNewEpisodes,
  loadNewOnDigital,
  loadNowPlaying,
  loadTrending,
  loadWatchingNow,
} from '../api/load-home-feed';
import { buildHighlights, buildHomeHero, buildWatchingNow, titleIds } from '../model/home-feed';
import { HeroBanner } from './hero-banner';
import { MovieListRail, type MovieList } from './movie-list-rail';
import { NewEpisodes } from './new-episodes';
import { SectionError } from './section-error';
import { TopTen } from './top-ten';
import { TopThree } from './top-three';
import { TrendingNow } from './trending-now';

export async function HeroSection() {
  const hero = await loadHero();
  if (!hero.ok) return null;

  const { lead, picks } = buildHomeHero(hero.data);

  return (
    <>
      {lead ? <HeroBanner hero={lead} /> : null}
      <TopThree list="picks" items={picks} />
    </>
  );
}

async function featuredIds(): Promise<Set<string>> {
  const [hero, watching] = await Promise.all([loadHero(), loadWatchingNow()]);
  return titleIds([...(hero.ok ? hero.data : []), ...(watching.ok ? watching.data : [])]);
}

export async function TrendingSection({ locale }: { locale: Locale }) {
  const [trending, excluded] = await Promise.all([loadTrending(), featuredIds()]);

  if (!trending.ok) return <SectionError message={getDictionary(locale).home.trendingFailed} />;

  return (
    <TrendingNow
      highlights={buildHighlights(trending.data.shows, trending.data.movies, excluded)}
    />
  );
}

export async function TopTenSection({ type }: { type: MediaType }) {
  const trending = await loadTrending();
  if (!trending.ok) return null;

  const items = type === 'show' ? trending.data.shows : trending.data.movies;
  return <TopTen type={type} items={items} />;
}

export async function WatchingNowSection() {
  const [watching, hero] = await Promise.all([loadWatchingNow(), loadHero()]);
  if (!watching.ok) return null;

  const excluded = titleIds(hero.ok ? hero.data : []);
  return <TopThree list="watchingNow" items={buildWatchingNow(watching.data, excluded)} />;
}

export async function NewEpisodesSection() {
  const releases = await loadNewEpisodes();
  return releases.ok ? <NewEpisodes releases={releases.data} /> : null;
}

const MOVIE_LOADERS = { nowPlaying: loadNowPlaying, newOnDigital: loadNewOnDigital };

export async function MovieListSection({ list }: { list: MovieList }) {
  const movies = await MOVIE_LOADERS[list]();
  return movies.ok ? <MovieListRail list={list} items={movies.data} /> : null;
}
