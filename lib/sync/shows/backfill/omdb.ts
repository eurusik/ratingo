import { db } from '@/db';
import { shows } from '@/db/schema';
import { eq, and, or, isNull, isNotNull } from 'drizzle-orm';
import { omdbClient } from '@/lib/api/omdb';
import type { BackfillOmdbStats } from '@/lib/types';

export async function runOmdbBackfill(): Promise<{ updated: number; stats: BackfillOmdbStats }> {
  let updated = 0;
  const stats: BackfillOmdbStats = {
    processed: 0,
    updatedRows: 0,
    imdbRatingUpdated: 0,
    imdbVotesUpdated: 0,
    metacriticUpdated: 0,
    missingImdbId: 0,
    errors: 0,
  };
  if (!process.env.OMDB_API_KEY) return { updated, stats };
  const rows = await db
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
  for (const showRow of rows) {
    stats.processed++;
    if (!showRow.imdbId) {
      stats.missingImdbId++;
      continue;
    }
    try {
      const aggregated = await omdbClient.getAggregatedRatings(showRow.imdbId);
      const imdbRating =
        typeof aggregated.imdbRating === 'number' && Number.isFinite(aggregated.imdbRating)
          ? aggregated.imdbRating
          : null;
      const imdbVotes =
        typeof aggregated.imdbVotes === 'number' && Number.isFinite(aggregated.imdbVotes)
          ? aggregated.imdbVotes
          : null;
      const metacriticScore =
        typeof aggregated.metacritic === 'number' && Number.isFinite(aggregated.metacritic)
          ? aggregated.metacritic
          : typeof aggregated.metascore === 'number' && Number.isFinite(aggregated.metascore)
            ? aggregated.metascore
            : null;
      if (showRow.ratingImdb == null && imdbRating != null) stats.imdbRatingUpdated++;
      if (showRow.imdbVotes == null && imdbVotes != null) stats.imdbVotesUpdated++;
      if (showRow.ratingMetacritic == null && metacriticScore != null) stats.metacriticUpdated++;
      await db
        .update(shows)
        .set({
          ratingImdb: imdbRating ?? showRow.ratingImdb ?? null,
          imdbVotes: imdbVotes ?? showRow.imdbVotes ?? null,
          ratingMetacritic: metacriticScore ?? showRow.ratingMetacritic ?? null,
          updatedAt: new Date(),
        })
        .where(eq(shows.id, showRow.id));
      updated++;
      stats.updatedRows++;
    } catch {
      stats.errors++;
    }
  }
  return { updated, stats };
}
