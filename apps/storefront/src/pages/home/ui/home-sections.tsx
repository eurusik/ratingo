import {
  loadHero,
  loadNewEpisodes,
  loadNewOnDigital,
  loadNowPlaying,
  loadTrending,
} from '../api/load-home-feed';
import { buildHomeHero, toReleaseRail } from '../model/home-feed';
import { HeroBanner } from './hero-banner';
import { NewEpisodes } from './new-episodes';
import { NewReleases } from './new-releases';
import { TopTen } from './top-ten';
import { TopTenError } from './top-ten-error';
import { TopThree } from './top-three';

export async function HeroSection() {
  const hero = await loadHero();
  if (!hero.ok) return null;

  const { lead, picks, firstPickRank } = buildHomeHero(hero.data);

  return (
    <>
      {lead ? <HeroBanner hero={lead} /> : null}
      <TopThree items={picks} firstRank={firstPickRank} />
    </>
  );
}

export async function TopTenSection() {
  const trending = await loadTrending();
  if (!trending.ok) return <TopTenError />;

  return <TopTen shows={trending.data.shows} movies={trending.data.movies} />;
}

export async function NewEpisodesSection() {
  const releases = await loadNewEpisodes();
  return releases.ok ? <NewEpisodes releases={releases.data} /> : null;
}

export async function NewReleasesSection() {
  const [nowPlaying, newOnDigital] = await Promise.all([loadNowPlaying(), loadNewOnDigital()]);

  return (
    <NewReleases
      lists={{
        nowPlaying: nowPlaying.ok ? toReleaseRail(nowPlaying.data) : [],
        newOnDigital: newOnDigital.ok ? toReleaseRail(newOnDigital.data) : [],
      }}
    />
  );
}
