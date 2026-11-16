import type { TrendingMedia } from '@/entities/media';
import type { HomeItem } from '@/shared/api';
import type { TrendingLists } from '../api/load-home-feed';
import {
  buildHomeHero,
  toReleaseRail,
  type EpisodeRelease,
  type Loaded,
} from '../model/home-feed';
import { HeroBanner } from './hero-banner';
import { HomeSectionError } from './home-section-error';
import { NewEpisodes } from './new-episodes';
import { NewReleases } from './new-releases';
import { TopTen } from './top-ten';
import { TopThree } from './top-three';

export function HeroSection({ hero }: { hero: Loaded<HomeItem[]> }) {
  if (!hero.ok) return <HomeSectionError section="picks" />;

  const { lead, picks, firstPickRank } = buildHomeHero(hero.data);

  return (
    <>
      {lead ? <HeroBanner hero={lead} /> : null}
      <TopThree items={picks} firstRank={firstPickRank} />
    </>
  );
}

export function TopTenSection({ trending }: { trending: Loaded<TrendingLists> }) {
  if (!trending.ok) return <HomeSectionError section="topTen" />;

  return <TopTen shows={trending.data.shows} movies={trending.data.movies} />;
}

export function NewEpisodesSection({ releases }: { releases: Loaded<EpisodeRelease[]> }) {
  if (!releases.ok) return <HomeSectionError section="newEpisodes" />;

  return <NewEpisodes releases={releases.data} />;
}

interface NewReleasesSectionProps {
  nowPlaying: Loaded<TrendingMedia[]>;
  newOnDigital: Loaded<TrendingMedia[]>;
}

export function NewReleasesSection({ nowPlaying, newOnDigital }: NewReleasesSectionProps) {
  if (!nowPlaying.ok && !newOnDigital.ok) return <HomeSectionError section="newReleases" />;

  return (
    <NewReleases
      lists={{
        nowPlaying: nowPlaying.ok ? toReleaseRail(nowPlaying.data) : [],
        newOnDigital: newOnDigital.ok ? toReleaseRail(newOnDigital.data) : [],
      }}
    />
  );
}
