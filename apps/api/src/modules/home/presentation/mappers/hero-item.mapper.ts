import { HeroMediaItem } from '../../../catalog/domain/models/hero-media.model';
import {
  HeroItemDto,
  HeroStatsDto,
  HeroExternalRatingsDto,
  HeroShowProgressDto,
} from '../dtos/hero-item.dto';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

/**
 * Maps domain HeroMediaItem to presentation HeroItemDto.
 */
export class HeroItemMapper {
  /**
   * Maps a single hero media item to DTO.
   */
  static toDto(item: HeroMediaItem): HeroItemDto {
    const dto = new HeroItemDto();

    dto.id = item.id;
    dto.mediaItemId = item.mediaItemId;
    dto.type = item.type;
    dto.slug = item.slug;
    dto.title = item.title;
    dto.originalTitle = item.originalTitle ?? item.title;
    dto.overview = item.overview;
    dto.primaryTrailerKey = item.primaryTrailerKey;
    dto.poster = this.mapImage(item.poster);
    dto.backdrop = this.mapImage(item.backdrop);
    dto.releaseDate = item.releaseDate;
    dto.isNew = item.isNew;
    dto.isClassic = item.isClassic;
    dto.stats = this.mapStats(item.stats);
    dto.externalRatings = this.mapExternalRatings(item.externalRatings);

    if (item.showProgress) {
      dto.showProgress = this.mapShowProgress(item.showProgress);
    }

    return dto;
  }

  /**
   * Maps multiple hero media items to DTOs.
   */
  static toDtoList(items: HeroMediaItem[]): HeroItemDto[] {
    return items.map((item) => this.toDto(item));
  }

  private static mapImage(
    image: { small: string; medium: string; large: string; original: string } | null,
  ): ImageDto {
    if (!image) {
      return { small: '', medium: '', large: '', original: '' };
    }
    return {
      small: image.small,
      medium: image.medium,
      large: image.large,
      original: image.original,
    };
  }

  private static mapStats(stats: HeroMediaItem['stats']): HeroStatsDto {
    return {
      ratingoScore: stats.ratingoScore ?? 0,
      qualityScore: stats.qualityScore ?? 0,
      liveWatchers: stats.liveWatchers ?? undefined,
      totalWatchers: stats.totalWatchers ?? undefined,
    };
  }

  private static mapExternalRatings(
    ratings: HeroMediaItem['externalRatings'],
  ): HeroExternalRatingsDto {
    return {
      tmdb: ratings.tmdb
        ? { rating: ratings.tmdb.rating, voteCount: ratings.tmdb.voteCount }
        : undefined,
      imdb: ratings.imdb
        ? { rating: ratings.imdb.rating, voteCount: ratings.imdb.voteCount }
        : undefined,
      trakt: ratings.trakt
        ? { rating: ratings.trakt.rating, voteCount: ratings.trakt.voteCount }
        : undefined,
      metacritic: ratings.metacritic ? { rating: ratings.metacritic.rating } : undefined,
      rottenTomatoes: ratings.rottenTomatoes
        ? { rating: ratings.rottenTomatoes.rating }
        : undefined,
    };
  }

  private static mapShowProgress(
    progress: NonNullable<HeroMediaItem['showProgress']>,
  ): HeroShowProgressDto {
    return {
      season: progress.season ?? 0,
      episode: progress.episode ?? 0,
      label: progress.label ?? '',
      lastAirDate: progress.lastAirDate ?? undefined,
      nextAirDate: progress.nextAirDate ?? undefined,
    };
  }
}
