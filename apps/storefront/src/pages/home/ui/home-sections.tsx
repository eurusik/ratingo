import type { TrendingMedia } from '@/entities/media';
import type { HomeItem } from '@/shared/api';
import type { TrendingLists } from '../api/load-home-feed';
import { buildHomeHero, toReleaseRail, type EpisodeRelease, type Loaded } from '../model/home-feed';
import { HeroBanner } from './hero-banner';
import { HomeSectionError } from './home-section-error';
import { NewEpisodes } from './new-episodes';
import { NewReleases } from './new-releases';
import { TopTen } from './top-ten';
import { TopThree } from './top-three';

export async function HeroSection({ hero }: { hero: Promise<Loaded<HomeItem[]>> }) {
  const loaded = await hero;
  if (!loaded.ok) return <HomeSectionError section="picks" />;

  const { lead, picks, firstPickRank } = buildHomeHero(loaded.data);

  return (
    <>
      {lead ? <HeroBanner hero={lead} /> : null}
      <TopThree items={picks} firstRank={firstPickRank} />
    </>
  );
}

export async function TopTenSection({ trending }: { trending: Promise<Loaded<TrendingLists>> }) {
  const loaded = await trending;
  if (!loaded.ok) return <HomeSectionError section="topTen" />;

  return <TopTen shows={loaded.data.shows} movies={loaded.data.movies} />;
}

export async function NewEpisodesSection({
  releases,
}: {
  releases: Promise<Loaded<EpisodeRelease[]>>;
}) {
  const loaded = await releases;
  if (!loaded.ok) return <HomeSectionError section="newEpisodes" />;

  return <NewEpisodes releases={loaded.data} />;
}

interface NewReleasesSectionProps {
  nowPlaying: Promise<Loaded<TrendingMedia[]>>;
  newOnDigital: Promise<Loaded<TrendingMedia[]>>;
}

export async function NewReleasesSection({ nowPlaying, newOnDigital }: NewReleasesSectionProps) {
  const [cinemas, streaming] = await Promise.all([nowPlaying, newOnDigital]);
  if (!cinemas.ok && !streaming.ok) return <HomeSectionError section="newReleases" />;

  return (
    <NewReleases
      lists={{
        nowPlaying: cinemas.ok ? toReleaseRail(cinemas.data) : [],
        newOnDigital: streaming.ok ? toReleaseRail(streaming.data) : [],
      }}
    />
  );
}
