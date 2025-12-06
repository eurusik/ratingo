import { db } from '@/db';
import { shows } from '@/db/schema';
import { omdbClient } from '@/lib/api/omdb';
import { tmdbClient } from '@/lib/api/tmdb';
import { withRetry } from './utils';
import { eq, and, or, isNull, isNotNull } from 'drizzle-orm';

export async function runOmdbBackfill(): Promise<{ updated: number }> {
  let updated = 0;
  if (!process.env.OMDB_API_KEY) return { updated };
  const missing = await db
    .select({
      id: shows.id,
      imdbId: shows.imdbId,
      ratingImdb: shows.ratingImdb,
      ratingMetacritic: shows.ratingMetacritic,
      imdbVotes: shows.imdbVotes,
    })
    .from(shows)
    .where(
      and(
        or(isNull(shows.ratingImdb), isNull(shows.ratingMetacritic), isNull(shows.imdbVotes)),
        isNotNull(shows.imdbId)
      )
    )
    .limit(100);
  for (const row of missing) {
    if (!row.imdbId) continue;
    try {
      const agg = await omdbClient.getAggregatedRatings(row.imdbId);
      const rImdb =
        typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating)
          ? agg.imdbRating
          : null;
      const rVotes =
        typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes) ? agg.imdbVotes : null;
      const rMc =
        typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic)
          ? agg.metacritic
          : typeof agg.metascore === 'number' && Number.isFinite(agg.metascore)
            ? agg.metascore
            : null;
      await db
        .update(shows)
        .set({
          ratingImdb: rImdb ?? row.ratingImdb ?? null,
          imdbVotes: rVotes ?? row.imdbVotes ?? null,
          ratingMetacritic: rMc ?? row.ratingMetacritic ?? null,
          updatedAt: new Date(),
        })
        .where(eq(shows.id, row.id));
      updated++;
    } catch {}
  }
  return { updated };
}

export async function runMetaBackfill(): Promise<{ updated: number }> {
  let updated = 0;
  const missingMeta = await db
    .select({
      id: shows.id,
      tmdbId: shows.tmdbId,
      backdrop: shows.backdrop,
      genres: shows.genres,
      videos: shows.videos,
      numberOfSeasons: shows.numberOfSeasons,
      numberOfEpisodes: shows.numberOfEpisodes,
      latestSeasonNumber: shows.latestSeasonNumber,
      latestSeasonEpisodes: shows.latestSeasonEpisodes,
      lastEpisodeSeason: shows.lastEpisodeSeason,
      lastEpisodeNumber: shows.lastEpisodeNumber,
      lastEpisodeAirDate: shows.lastEpisodeAirDate,
      nextEpisodeSeason: shows.nextEpisodeSeason,
      nextEpisodeNumber: shows.nextEpisodeNumber,
      nextEpisodeAirDate: shows.nextEpisodeAirDate,
      status: shows.status,
      tagline: shows.tagline,
      firstAirDate: shows.firstAirDate,
      watchProviders: shows.watchProviders,
      contentRating: shows.contentRating,
    })
    .from(shows)
    .where(
      or(
        isNull(shows.backdrop),
        isNull(shows.genres),
        isNull(shows.videos),
        isNull(shows.numberOfSeasons),
        isNull(shows.latestSeasonNumber),
        isNull(shows.lastEpisodeNumber),
        isNull(shows.nextEpisodeNumber),
        isNull(shows.status),
        isNull(shows.firstAirDate)
      )
    )
    .limit(50);
  for (const row of missingMeta) {
    try {
      const tmdbShowData = await withRetry(() => tmdbClient.getShowDetails(row.tmdbId));
      const videosData = await withRetry(() => tmdbClient.getShowVideos(row.tmdbId));
      const allVideos = Array.isArray(videosData?.results) ? videosData.results : [];
      const videosFiltered = allVideos.filter(
        (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
      );
      const wpUa = await withRetry(() => tmdbClient.getWatchProvidersByRegion(row.tmdbId, 'UA'));
      const wpUs = await withRetry(() => tmdbClient.getWatchProvidersByRegion(row.tmdbId, 'US'));
      const wpCombined = (() => {
        const map = new Map<string, any>();
        for (const p of [...(wpUa || []), ...(wpUs || [])]) {
          const key = `${p.region}:${p.id}`;
          if (!map.has(key)) map.set(key, p);
        }
        return Array.from(map.values());
      })();
      const crUa = await withRetry(() => tmdbClient.getContentRatingByRegion(row.tmdbId, 'UA'));
      const seasonsArr = Array.isArray(tmdbShowData.seasons) ? tmdbShowData.seasons : [];
      let latestSeasonNumber: number | null = null;
      let latestSeasonEpisodes: number | null = null;
      if (seasonsArr.length > 0) {
        const sorted = seasonsArr
          .filter((s: any) => typeof s.season_number === 'number')
          .sort((a: any, b: any) => (b.season_number ?? 0) - (a.season_number ?? 0));
        const latest = sorted.find((s: any) => s.season_number !== 0) || sorted[0];
        latestSeasonNumber =
          typeof latest?.season_number === 'number' ? latest.season_number : null;
        latestSeasonEpisodes =
          typeof latest?.episode_count === 'number' ? latest.episode_count : null;
      }
      const lastEpisodeSeason = tmdbShowData.last_episode_to_air?.season_number ?? null;
      const lastEpisodeNumber = tmdbShowData.last_episode_to_air?.episode_number ?? null;
      const lastEpisodeAirDate = tmdbShowData.last_episode_to_air?.air_date ?? null;
      const nextEpisodeSeason = (tmdbShowData as any)?.next_episode_to_air?.season_number ?? null;
      const nextEpisodeNumber = (tmdbShowData as any)?.next_episode_to_air?.episode_number ?? null;
      const nextEpisodeAirDate = (tmdbShowData as any)?.next_episode_to_air?.air_date ?? null;
      await db
        .update(shows)
        .set({
          backdrop: tmdbShowData.backdrop_path ?? (row as any).backdrop ?? null,
          genres: Array.isArray(tmdbShowData.genres)
            ? tmdbShowData.genres
            : ((row as any).genres ?? []),
          videos: videosFiltered.length ? videosFiltered : ((row as any).videos ?? []),
          firstAirDate: tmdbShowData.first_air_date ?? (row as any).firstAirDate ?? null,
          numberOfSeasons:
            (typeof tmdbShowData.number_of_seasons === 'number'
              ? tmdbShowData.number_of_seasons
              : null) ??
            (row as any).numberOfSeasons ??
            null,
          numberOfEpisodes:
            (typeof tmdbShowData.number_of_episodes === 'number'
              ? tmdbShowData.number_of_episodes
              : null) ??
            (row as any).numberOfEpisodes ??
            null,
          latestSeasonNumber: latestSeasonNumber ?? (row as any).latestSeasonNumber ?? null,
          latestSeasonEpisodes: latestSeasonEpisodes ?? (row as any).latestSeasonEpisodes ?? null,
          lastEpisodeSeason: lastEpisodeSeason ?? (row as any).lastEpisodeSeason ?? null,
          lastEpisodeNumber: lastEpisodeNumber ?? (row as any).lastEpisodeNumber ?? null,
          lastEpisodeAirDate: lastEpisodeAirDate ?? (row as any).lastEpisodeAirDate ?? null,
          nextEpisodeSeason: nextEpisodeSeason ?? (row as any).nextEpisodeSeason ?? null,
          nextEpisodeNumber: nextEpisodeNumber ?? (row as any).nextEpisodeNumber ?? null,
          nextEpisodeAirDate: nextEpisodeAirDate ?? (row as any).nextEpisodeAirDate ?? null,
          status: tmdbShowData.status ?? (row as any).status ?? null,
          tagline: tmdbShowData.tagline ?? (row as any).tagline ?? null,
          contentRating: crUa ?? (row as any).contentRating ?? null,
          watchProviders: wpCombined ?? (row as any).watchProviders ?? null,
          updatedAt: new Date(),
        })
        .where(eq(shows.id, row.id));
      updated++;
    } catch {}
  }
  return { updated };
}
