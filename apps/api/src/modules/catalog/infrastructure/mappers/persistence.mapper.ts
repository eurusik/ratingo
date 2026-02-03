/**
 * Re-exports for backward compatibility.
 * Prefer importing from specific mappers directly:
 * - MediaItemPersistenceMapper for media_items and media_stats
 * - MoviePersistenceMapper for movies
 * - ShowPersistenceMapper for shows
 * - SeasonEpisodePersistenceMapper for seasons and episodes
 */

import { MediaItemPersistenceMapper } from './media-item-persistence.mapper';
import { MoviePersistenceMapper } from './movie-persistence.mapper';
import { SeasonEpisodePersistenceMapper } from './season-episode-persistence.mapper';
import { ShowPersistenceMapper } from './show-persistence.mapper';

/**
 * @deprecated Use specific mappers directly:
 * - MediaItemPersistenceMapper
 * - MoviePersistenceMapper
 * - ShowPersistenceMapper
 * - SeasonEpisodePersistenceMapper
 */
export class PersistenceMapper {
  // MediaItem methods
  static toMediaItemInsert = MediaItemPersistenceMapper.toMediaItemInsert;
  static toMediaItemUpdate = MediaItemPersistenceMapper.toMediaItemUpdate;
  static toMediaStatsInsert = MediaItemPersistenceMapper.toMediaStatsInsert;

  // Movie methods
  static toMovieInsert = MoviePersistenceMapper.toMovieInsert;
  static toMovieUpdate = MoviePersistenceMapper.toMovieUpdate;

  // Show methods
  static toShowInsert = ShowPersistenceMapper.toShowInsert;
  static toShowUpdate = ShowPersistenceMapper.toShowUpdate;

  // Season/Episode methods
  static toSeasonInsert = SeasonEpisodePersistenceMapper.toSeasonInsert;
  static toSeasonUpdate = SeasonEpisodePersistenceMapper.toSeasonUpdate;
  static toEpisodeInsert = SeasonEpisodePersistenceMapper.toEpisodeInsert;
  static toEpisodeUpdate = SeasonEpisodePersistenceMapper.toEpisodeUpdate;
}
