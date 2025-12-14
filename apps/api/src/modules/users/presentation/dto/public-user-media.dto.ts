import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  OffsetPaginationMetaDto,
  OffsetPaginationQueryDto,
} from '../../../catalog/presentation/dtos/pagination.dto';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  UserMediaState,
  USER_MEDIA_STATE_VALUES,
} from '../../../user-media/domain/entities/user-media-state.entity';

export const USER_MEDIA_LIST_SORT = {
  RECENT: 'recent',
  RATING: 'rating',
  RELEASE_DATE: 'releaseDate',
} as const;

export type UserMediaListSort = (typeof USER_MEDIA_LIST_SORT)[keyof typeof USER_MEDIA_LIST_SORT];
export const USER_MEDIA_LIST_SORT_VALUES = Object.values(USER_MEDIA_LIST_SORT);

/**
 * Query DTO for public user media lists.
 */
export class PublicUserMediaListQueryDto extends OffsetPaginationQueryDto {
  /**
   * Defines sorting for the list.
   */
  @ApiPropertyOptional({
    required: false,
    enum: USER_MEDIA_LIST_SORT_VALUES,
    default: USER_MEDIA_LIST_SORT.RECENT,
  })
  @IsOptional()
  @IsIn(USER_MEDIA_LIST_SORT_VALUES)
  sort?: UserMediaListSort = USER_MEDIA_LIST_SORT.RECENT;
}

/**
 * Represents media summary in public lists.
 */
export class PublicUserMediaSummaryDto {
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
}

/**
 * Represents a single item in public user media lists.
 */
export class PublicUserMediaListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: USER_MEDIA_STATE_VALUES })
  state!: UserMediaState['state'];

  @ApiProperty({ nullable: true, description: '0-100 rating' })
  rating!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Arbitrary progress payload (JSON)' })
  progress?: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: PublicUserMediaSummaryDto })
  mediaSummary!: PublicUserMediaSummaryDto;
}

/**
 * Represents a paginated public user media list response.
 */
export class PaginatedPublicUserMediaResponseDto {
  @ApiProperty({ type: PublicUserMediaListItemDto, isArray: true })
  data!: PublicUserMediaListItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta!: OffsetPaginationMetaDto;
}
