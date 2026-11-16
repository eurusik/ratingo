import { Suspense, type ReactNode } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { feedSections, startHomeFeed, type HomeFeed } from '../api/load-home-feed';
import { anySectionLoads } from '../model/home-feed';
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

function HeroSkeletons() {
  return (
    <>
      <HeroSkeleton />
      <TopThreeSkeleton />
    </>
  );
}

function HomeFeedSkeleton() {
  return (
    <>
      <HeroSkeletons />
      <TileRailSkeleton />
      <TileRailSkeleton />
      <CardRailSkeleton />
    </>
  );
}

async function UnlessFeedIsDown({ feed, children }: { feed: HomeFeed; children: ReactNode }) {
  const isUp = await anySectionLoads(feedSections(feed));
  return isUp ? children : <HomeOutage />;
}

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const feed = startHomeFeed();

  return (
    <div className="flex flex-col gap-8 pb-8 md:gap-10">
      <h1 className="sr-only">{dict.home.heading}</h1>
      <Suspense fallback={<HomeFeedSkeleton />}>
        <UnlessFeedIsDown feed={feed}>
          <Suspense fallback={<HeroSkeletons />}>
            <HeroSection hero={feed.hero} />
          </Suspense>
          <Suspense fallback={<TileRailSkeleton />}>
            <TopTenSection trending={feed.trending} />
          </Suspense>
          <Suspense fallback={<TileRailSkeleton />}>
            <NewEpisodesSection releases={feed.newEpisodes} />
          </Suspense>
          <Suspense fallback={<CardRailSkeleton />}>
            <NewReleasesSection nowPlaying={feed.nowPlaying} newOnDigital={feed.newOnDigital} />
          </Suspense>
          <TrackShowsCard />
        </UnlessFeedIsDown>
      </Suspense>
    </div>
  );
}
