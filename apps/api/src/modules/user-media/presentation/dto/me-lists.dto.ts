import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  OffsetPaginationMetaDto,
  OffsetPaginationQueryDto,
} from '../../../catalog/presentation/dtos/pagination.dto';
import {
  USER_MEDIA_LIST_SORT,
  UserMediaListSort,
} from '../../domain/repositories/user-media-state.repository.interface';
import { UserMediaStateDto } from './user-media-state.dto';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { CardMetaDto } from '../../../shared/cards/presentation/dtos/card-meta.dto';

export const ME_USER_MEDIA_LIST_SORT_VALUES = Object.values(USER_MEDIA_LIST_SORT);

/**
 * Query DTO for owner-only media lists.
 */
export class MeUserMediaListQueryDto extends OffsetPaginationQueryDto {
  /**
   * Defines sorting for the list.
   */
  @ApiPropertyOptional({
    required: false,
    enum: ME_USER_MEDIA_LIST_SORT_VALUES,
    default: USER_MEDIA_LIST_SORT.RECENT,
  })
  @IsOptional()
  @IsIn(ME_USER_MEDIA_LIST_SORT_VALUES)
  sort?: UserMediaListSort = USER_MEDIA_LIST_SORT.RECENT;
}

/**
 * Represents media summary in owner-only lists.
 */
export class MeUserMediaSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: [MediaType.MOVIE, MediaType.SHOW] })
  type!: MediaType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  poster!: ImageDto | null;

  @ApiPropertyOptional({ nullable: true })
  releaseDate?: Date | null;

  @ApiPropertyOptional({ type: CardMetaDto, required: false })
  card?: CardMetaDto;
}

/**
 * Represents a single item in owner-only media lists.
 */
export class MeUserMediaListItemDto extends UserMediaStateDto {
  @ApiProperty({ type: MeUserMediaSummaryDto })
  mediaSummary!: MeUserMediaSummaryDto;
}

/**
 * Represents a paginated owner-only media list response.
 */
export class PaginatedMeUserMediaResponseDto {
  @ApiProperty({ type: MeUserMediaListItemDto, isArray: true })
  data!: MeUserMediaListItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta!: OffsetPaginationMetaDto;
}
