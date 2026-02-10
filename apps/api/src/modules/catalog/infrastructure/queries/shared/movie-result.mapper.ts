import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import type {
  MovieWithMedia,
  TrendingMovieItem,
} from '../../../domain/repositories/movie.repository.interface';
import type { GenreInfo } from '../../../domain/types/common.types';

import type { MovieSelectRow } from './movie-select.fields';
import { calculateReleaseFlags } from './release-flags.util';

/**
 * Shared mapper for movie query results.
 * Eliminates duplication between TrendingMoviesQuery and MovieListingsQuery.
 */
export class MovieResultMapper {
  /**
   * Maps a raw database row to MovieWithMedia DTO.
   */
  static toMovieWithMedia(row: MovieSelectRow, genres: GenreInfo[]): MovieWithMedia {
    return {
      id: row.id,
      mediaItemId: row.mediaItemId,
      tmdbId: row.tmdbId,
      title: row.title,
      slug: row.slug,
      overview: row.overview,
      ingestionStatus: row.ingestionStatus as MovieWithMedia['ingestionStatus'],
      poster: ImageMapper.toPoster(row.posterPath),
      backdrop: ImageMapper.toBackdrop(row.backdropPath),
      popularity: row.popularity,
      releaseDate: row.releaseDate,
      theatricalReleaseDate: row.theatricalReleaseDate,
      digitalReleaseDate: row.digitalReleaseDate,
      runtime: row.runtime,
      videos: null,

      stats: {
        ratingoScore: row.ratingoScore,
        qualityScore: row.qualityScore,
        popularityScore: row.popularityScore,
        liveWatchers: row.watchersCount,
        totalWatchers: row.totalWatchers,
        communityAverageRating: null,
        communityRatingCount: null,
      },
      externalRatings: {
        tmdb: { rating: row.rating, voteCount: row.voteCount },
        imdb: row.ratingImdb ? { rating: row.ratingImdb, voteCount: row.voteCountImdb } : null,
        trakt: row.ratingTrakt ? { rating: row.ratingTrakt, voteCount: row.voteCountTrakt } : null,
        metacritic: row.ratingMetacritic ? { rating: row.ratingMetacritic } : null,
        rottenTomatoes: row.ratingRottenTomatoes ? { rating: row.ratingRottenTomatoes } : null,
      },

      genres,
    };
  }

  /**
   * Maps a raw database row to TrendingMovieItem DTO with isNew/isClassic flags.
   */
  static toTrendingItem(row: MovieSelectRow, genres: GenreInfo[]): TrendingMovieItem {
    const base = this.toMovieWithMedia(row, genres);
    const { isNew, isClassic } = calculateReleaseFlags(
      row.releaseDate,
      row.ratingoScore,
      row.totalWatchers,
    );

    return { ...base, isNew, isClassic };
  }

  /**
   * Maps multiple rows with genres map to MovieWithMedia array.
   */
  static mapMany(rows: MovieSelectRow[], genresMap: Map<string, GenreInfo[]>): MovieWithMedia[] {
    return rows.map((row) => this.toMovieWithMedia(row, genresMap.get(row.mediaItemId) || []));
  }

  /**
   * Maps multiple rows with genres map to TrendingMovieItem array.
   */
  static mapManyTrending(
    rows: MovieSelectRow[],
    genresMap: Map<string, GenreInfo[]>,
  ): TrendingMovieItem[] {
    return rows.map((row) => this.toTrendingItem(row, genresMap.get(row.mediaItemId) || []));
  }
}
