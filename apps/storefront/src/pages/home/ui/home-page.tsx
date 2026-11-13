import { Suspense } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { preloadHomeFeed } from '../api/load-home-feed';
import {
  HeroSection,
  MovieListSection,
  NewEpisodesSection,
  TopTenSection,
  TrendingSection,
  WatchingNowSection,
} from './home-sections';
import {
  CardRailSkeleton,
  HeroSkeleton,
  TileRailSkeleton,
  TopThreeSkeleton,
} from './home-skeletons';
import { TrackShowsCard } from './track-shows-card';

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  preloadHomeFeed();

  return (
    <div className="flex flex-col gap-8 pb-8 md:gap-10 md:pt-4">
      <h1 className="sr-only">{dict.home.heading}</h1>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={<CardRailSkeleton />}>
        <TrendingSection locale={locale} />
      </Suspense>
      <Suspense fallback={<TileRailSkeleton />}>
        <TopTenSection type="show" />
      </Suspense>
      <TrackShowsCard />
      <Suspense fallback={<TopThreeSkeleton />}>
        <WatchingNowSection />
      </Suspense>
      <Suspense fallback={<TileRailSkeleton />}>
        <NewEpisodesSection />
      </Suspense>
      <Suspense fallback={<TileRailSkeleton />}>
        <TopTenSection type="movie" />
      </Suspense>
      <Suspense fallback={<CardRailSkeleton />}>
        <MovieListSection list="nowPlaying" />
      </Suspense>
      <Suspense fallback={<CardRailSkeleton />}>
        <MovieListSection list="newOnDigital" />
      </Suspense>
    </div>
  );
}
