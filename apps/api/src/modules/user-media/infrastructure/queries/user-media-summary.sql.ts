import { sql } from 'drizzle-orm';

import { MediaType } from '@/common/enums/media-type.enum';
import * as schema from '@/database/schema';
import { type ContinuePoint } from '@/modules/user-media/domain/repositories/user-media-state.repository.interface';

export const mediaSummaryColumns = {
  id: schema.mediaItems.id,
  type: schema.mediaItems.type,
  title: schema.mediaItems.title,
  slug: schema.mediaItems.slug,
  posterPath: schema.mediaItems.posterPath,
  releaseDate: schema.mediaItems.releaseDate,
  qualityScore: schema.mediaStats.qualityScore,
};

export function progressTotalSql() {
  return sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.episodes} e
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_total');
}

export function progressWatchedSql(userId: string) {
  return sql<number | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                SELECT COUNT(*)::int FROM ${schema.userEpisodeProgress} uep
                JOIN ${schema.episodes} e ON e.id = uep.episode_id
                JOIN ${schema.seasons} s ON s.id = e.season_id
                JOIN ${schema.shows} sh ON sh.id = s.show_id
                WHERE sh.media_item_id = ${schema.mediaItems.id}
                AND uep.user_id = ${userId}
                AND s.number > 0
              ) ELSE NULL END
            `.as('progress_watched');
}

export function noContinuePointSql() {
  return sql<ContinuePoint | null>`NULL`.as('continue_point');
}

export function continuePointSql(userId: string) {
  return sql<ContinuePoint | null>`
              CASE WHEN ${schema.mediaItems.type} = ${MediaType.SHOW} THEN (
                WITH last_watched AS (
                  SELECT s.number AS sn, e.number AS en
                  FROM ${schema.userEpisodeProgress} uep
                  JOIN ${schema.episodes} e ON e.id = uep.episode_id
                  JOIN ${schema.seasons} s ON s.id = e.season_id
                  JOIN ${schema.shows} sh ON sh.id = s.show_id
                  WHERE sh.media_item_id = ${schema.mediaItems.id}
                  AND uep.user_id = ${userId}
                  ORDER BY s.number DESC, e.number DESC
                  LIMIT 1
                ),
                next_episode AS (
                  SELECT s.number AS season, e.number AS episode, e.id AS episode_id, to_char(e.air_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS air_date
                  FROM ${schema.episodes} e
                  JOIN ${schema.seasons} s ON s.id = e.season_id
                  JOIN ${schema.shows} sh ON sh.id = s.show_id
                  WHERE sh.media_item_id = ${schema.mediaItems.id}
                  AND s.number > 0
                  AND NOT EXISTS (
                    SELECT 1 FROM ${schema.userEpisodeProgress} uep
                    WHERE uep.user_id = ${userId} AND uep.episode_id = e.id
                  )
                  AND (
                    NOT EXISTS (SELECT 1 FROM last_watched)
                    OR s.number > (SELECT sn FROM last_watched)
                    OR (s.number = (SELECT sn FROM last_watched) AND e.number > (SELECT en FROM last_watched))
                  )
                  ORDER BY s.number ASC, e.number ASC
                  LIMIT 1
                )
                SELECT json_build_object('season', season, 'episode', episode, 'episodeId', episode_id, 'airDate', air_date) FROM next_episode
              ) ELSE NULL END
            `.as('continue_point');
}
