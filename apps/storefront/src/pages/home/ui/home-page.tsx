import { Suspense } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { loadHomeFeed } from '../api/load-home-feed';
import { isFeedDown } from '../model/home-feed';
import { HomeOutage } from './home-outage';
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

function HomeFeedSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <TopThreeSkeleton />
      <TileRailSkeleton />
      <TileRailSkeleton />
      <CardRailSkeleton />
    </>
  );
}

async function HomeFeed() {
  const feed = await loadHomeFeed();
  if (isFeedDown(Object.values(feed))) return <HomeOutage />;

  return (
    <>
      <HeroSection hero={feed.hero} />
      <TopTenSection trending={feed.trending} />
      <NewEpisodesSection releases={feed.newEpisodes} />
      <NewReleasesSection nowPlaying={feed.nowPlaying} newOnDigital={feed.newOnDigital} />
      <TrackShowsCard />
    </>
  );
}

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <div className="flex flex-col gap-8 pb-8 md:gap-10">
      <h1 className="sr-only">{dict.home.heading}</h1>
      <Suspense fallback={<HomeFeedSkeleton />}>
        <HomeFeed />
      </Suspense>
    </div>
  );
}
