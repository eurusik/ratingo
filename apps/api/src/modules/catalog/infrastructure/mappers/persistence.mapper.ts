import { NormalizedMedia } from '../../../ingestion/domain/models/normalized-media.model';
import * as schema from '../../../../database/schema';
import { InferInsertModel } from 'drizzle-orm';

type MediaItemInsert = InferInsertModel<typeof schema.mediaItems>;
type MediaStatsInsert = InferInsertModel<typeof schema.mediaStats>;

export class PersistenceMapper {
  static toMediaItemInsert(media: NormalizedMedia): MediaItemInsert {
    return {
      type: media.type,
      tmdbId: media.externalIds.tmdbId,
      imdbId: media.externalIds.imdbId || null,
      title: media.title,
      originalTitle: media.originalTitle,
      slug: media.slug,
      overview: media.overview,
      ingestionStatus: media.ingestionStatus,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      videos: media.videos || null,
      credits: media.credits || null,
      watchProviders: media.watchProviders || null,

      // Metrics
      rating: media.rating,
      voteCount: media.voteCount,
      popularity: media.popularity,
      trendingScore: media.trendingScore ?? 0,
      trendingUpdatedAt:
        media.trendingUpdatedAt instanceof Date
          ? media.trendingUpdatedAt
          : media.trendingUpdatedAt
            ? new Date(media.trendingUpdatedAt)
            : null,

      // External Ratings
      ratingImdb: media.ratingImdb,
      voteCountImdb: media.voteCountImdb,
      ratingTrakt: media.ratingTrakt,
      voteCountTrakt: media.voteCountTrakt,
      ratingMetacritic: media.ratingMetacritic,
      ratingRottenTomatoes: media.ratingRottenTomatoes,

      releaseDate:
        media.releaseDate instanceof Date
          ? media.releaseDate
          : media.releaseDate
            ? new Date(media.releaseDate)
            : null,
      updatedAt: new Date(),
    };
  }

  static toMediaItemUpdate(media: NormalizedMedia): Partial<MediaItemInsert> {
    const releaseDate =
      media.releaseDate instanceof Date
        ? media.releaseDate
        : media.releaseDate
          ? new Date(media.releaseDate)
          : null;

    const trendingUpdatedAt =
      media.trendingUpdatedAt instanceof Date
        ? media.trendingUpdatedAt
        : media.trendingUpdatedAt
          ? new Date(media.trendingUpdatedAt)
          : new Date();

    const update: Partial<MediaItemInsert> = {
      imdbId: media.externalIds.imdbId || null,
      title: media.title,
      originalTitle: media.originalTitle,
      slug: media.slug,
      overview: media.overview,
      ingestionStatus: media.ingestionStatus,
      rating: media.rating,
      voteCount: media.voteCount,
      popularity: media.popularity,
      ratingImdb: media.ratingImdb,
      voteCountImdb: media.voteCountImdb,
      ratingTrakt: media.ratingTrakt,
      voteCountTrakt: media.voteCountTrakt,
      ratingMetacritic: media.ratingMetacritic,
      ratingRottenTomatoes: media.ratingRottenTomatoes,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      videos: media.videos || null,
      credits: media.credits || null,
      watchProviders: media.watchProviders || null,
      releaseDate,
      updatedAt: new Date(),
      ...(media.trendingScore !== undefined && {
        trendingScore: media.trendingScore,
        trendingUpdatedAt,
      }),
    };

    // Filter out undefined values
    const filtered = Object.fromEntries(
      Object.entries(update).filter(([, v]) => v !== undefined),
    ) as Partial<MediaItemInsert>;

    // Always ensure updatedAt is present to prevent "No values to set" error
    filtered.updatedAt = new Date();

    return filtered;
  }

  static toMediaStatsInsert(mediaId: string, media: NormalizedMedia): MediaStatsInsert | null {
    if (media.ratingoScore === undefined) return null;

    return {
      mediaItemId: mediaId,
      ratingoScore: media.ratingoScore,
      qualityScore: media.qualityScore,
      popularityScore: media.popularityScore,
      freshnessScore: media.freshnessScore,
      watchersCount: media.watchersCount ?? 0,
      totalWatchers: media.totalWatchers ?? 0,
      updatedAt: new Date(),
    };
  }

  static toMovieInsert(mediaId: string, details: any): InferInsertModel<typeof schema.movies> {
    return {
      mediaItemId: mediaId,
      runtime: details.runtime,
      budget: details.budget,
      revenue: details.revenue,
      status: details.status,
      theatricalReleaseDate: details.theatricalReleaseDate,
      digitalReleaseDate: details.digitalReleaseDate,
      releases: details.releases,
    };
  }

  static toMovieUpdate(details: any): Partial<InferInsertModel<typeof schema.movies>> {
    return {
      runtime: details.runtime,
      budget: details.budget,
      revenue: details.revenue,
      status: details.status,
      theatricalReleaseDate: details.theatricalReleaseDate,
      digitalReleaseDate: details.digitalReleaseDate,
      releases: details.releases,
    };
  }

  static toShowInsert(mediaId: string, details: any): InferInsertModel<typeof schema.shows> {
    return {
      mediaItemId: mediaId,
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      lastAirDate: details.lastAirDate,
      nextAirDate: details.nextAirDate,
      status: details.status,
    };
  }

  static toShowUpdate(details: any): Partial<InferInsertModel<typeof schema.shows>> {
    return {
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      lastAirDate: details.lastAirDate,
      nextAirDate: details.nextAirDate,
      status: details.status,
    };
  }

  static toSeasonInsert(showId: string, season: any): InferInsertModel<typeof schema.seasons> {
    return {
      showId: showId,
      tmdbId: season.tmdbId,
      number: season.number,
      name: season.name,
      overview: season.overview,
      posterPath: season.posterPath,
      airDate: season.airDate,
      episodeCount: season.episodeCount,
    };
  }

  static toSeasonUpdate(season: any): Partial<InferInsertModel<typeof schema.seasons>> {
    return {
      tmdbId: season.tmdbId,
      name: season.name,
      overview: season.overview,
      posterPath: season.posterPath,
      airDate: season.airDate,
      episodeCount: season.episodeCount,
    };
  }

  static toEpisodeInsert(
    seasonId: string,
    showId: string,
    episode: any,
  ): InferInsertModel<typeof schema.episodes> {
    return {
      seasonId: seasonId,
      showId: showId,
      tmdbId: episode.tmdbId,
      number: episode.number,
      title: episode.title,
      overview: episode.overview,
      airDate: episode.airDate,
      runtime: episode.runtime,
      stillPath: episode.stillPath,
      voteAverage: episode.rating,
    };
  }

  static toEpisodeUpdate(episode: any): Partial<InferInsertModel<typeof schema.episodes>> {
    return {
      tmdbId: episode.tmdbId,
      title: episode.title,
      overview: episode.overview,
      airDate: episode.airDate,
      runtime: episode.runtime,
      stillPath: episode.stillPath,
      voteAverage: episode.rating,
    };
  }
}
