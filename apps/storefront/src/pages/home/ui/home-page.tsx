import { Suspense } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { preloadHomeFeed } from '../api/load-home-feed';
import {
  HeroSection,
  NewEpisodesSection,
  NewReleasesSection,
  TopTenSection,
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
    <div className="flex flex-col gap-8 pb-8 md:gap-10">
      <h1 className="sr-only">{dict.home.heading}</h1>
      <Suspense
        fallback={
          <>
            <HeroSkeleton />
            <TopThreeSkeleton />
          </>
        }
      >
        <HeroSection />
      </Suspense>
      <Suspense fallback={<TileRailSkeleton />}>
        <TopTenSection />
      </Suspense>
      <Suspense fallback={<TileRailSkeleton />}>
        <NewEpisodesSection />
      </Suspense>
      <Suspense fallback={<CardRailSkeleton />}>
        <NewReleasesSection />
      </Suspense>
      <TrackShowsCard />
    </div>
  );
}
