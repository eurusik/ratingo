import { and, eq, gt, inArray, isNull, lte, notExists, sql, type SQL } from 'drizzle-orm';

import {
  SPECIALS_SEASON_NUMBER,
  UNDATED_UNRELEASED_SHOW_STATUSES,
} from '@/modules/shared/show-premiere';

import * as schema from './schema';
import { allOf, anyOf } from './sql-conditions';

function airedRegularEpisode(asOf: Date): SQL {
  return sql`(select 1 from ${schema.episodes} inner join ${schema.seasons} on ${eq(
    schema.seasons.id,
    schema.episodes.seasonId,
  )} where ${and(
    eq(schema.seasons.showId, schema.shows.id),
    gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
    lte(schema.episodes.airDate, asOf),
  )})`;
}

function premiereAhead(asOf: Date): SQL {
  return anyOf(
    gt(schema.mediaItems.releaseDate, asOf),
    allOf(
      isNull(schema.mediaItems.releaseDate),
      inArray(schema.shows.status, [...UNDATED_UNRELEASED_SHOW_STATUSES]),
    ),
  );
}

function firstRegularEpisodeAirDate(): SQL {
  return sql`(select ${schema.episodes.airDate} from ${schema.episodes} inner join ${
    schema.seasons
  } on ${eq(schema.seasons.id, schema.episodes.seasonId)} inner join ${schema.shows} on ${eq(
    schema.shows.id,
    schema.seasons.showId,
  )} where ${and(
    eq(schema.shows.mediaItemId, schema.mediaItems.id),
    gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
  )} order by ${schema.seasons.number} asc, ${schema.episodes.number} asc limit 1)`;
}

export function showPremiereInstant(): SQL<Date | null> {
  const premiere = sql<Date | null>`coalesce(${firstRegularEpisodeAirDate()}, ${schema.mediaItems.releaseDate})`;
  return premiere.mapWith(schema.mediaItems.releaseDate);
}

export function onlyShowsAwaitingPremiere(asOf: Date): SQL {
  return sql`exists (select 1 from ${schema.shows} where ${and(
    eq(schema.shows.mediaItemId, schema.mediaItems.id),
    premiereAhead(asOf),
    notExists(airedRegularEpisode(asOf)),
  )})`;
}
