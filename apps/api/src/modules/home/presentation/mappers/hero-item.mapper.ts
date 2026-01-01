import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { HeroItemDto, type HeroShowProgressDto } from '../dtos/hero-item.dto';

const EMPTY_IMAGE = { small: '', medium: '', large: '', original: '' };

/**
 * Maps domain HeroMediaItem to presentation HeroItemDto.
 * Provides API contract guarantees: non-null objects, fallbacks, normalized values.
 */
export class HeroItemMapper {
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
    dto.poster = item.poster ?? EMPTY_IMAGE;
    dto.backdrop = item.backdrop ?? EMPTY_IMAGE;
    dto.releaseDate = item.releaseDate;
    dto.isNew = item.isNew;
    dto.isClassic = item.isClassic;
    dto.stats = item.stats;
    dto.externalRatings = item.externalRatings;

    if (item.showProgress) {
      dto.showProgress = this.mapShowProgress(item.showProgress);
    }

    return dto;
  }

  static toDtoList(items: HeroMediaItem[]): HeroItemDto[] {
    return items.map((item) => this.toDto(item));
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
