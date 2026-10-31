import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { OffsetPaginationMetaDto, OffsetPaginationQueryDto } from '../../../../common/dtos';
import { type ImageDto } from '../../../../common/dtos/image.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { CardMetaDto } from '../../../shared/cards';
import { type UserListCounts } from '../../domain/entities/user-list-counts.entity';
import {
  USER_MEDIA_HISTORY_STATES,
  type UserMediaHistoryState,
} from '../../domain/entities/user-media-state.entity';
import {
  USER_MEDIA_LIST_SORT,
  type UserMediaListSort,
} from '../../domain/repositories/user-media-state.repository.interface';

import { UserMediaStateDto } from './user-media-state.dto';

/**
 * Aggregated episode progress summary for shows.
 */
export class ProgressSummaryDto {
  @ApiProperty({ description: 'Number of watched episodes', example: 5 })
  watched!: number;

  @ApiProperty({ description: 'Total number of episodes', example: 10 })
  total!: number;
}

/**
 * Continue point for shows (next episode to watch).
 */
export class ContinuePointDto {
  @ApiProperty({ description: 'Season number to continue from', example: 2 })
  season!: number;

  @ApiProperty({ description: 'Episode number to continue from', example: 5 })
  episode!: number;
}

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

  /**
   * Filters by media type (movie or show).
   */
  @ApiPropertyOptional({
    required: false,
    enum: [MediaType.MOVIE, MediaType.SHOW],
    description: 'Filter by media type',
  })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}

/**
 * Query DTO for the history endpoint. Allows narrowing the result to a
 * single state within the history set (watching / completed / paused).
 */
export class MeHistoryListQueryDto extends MeUserMediaListQueryDto {
  @ApiPropertyOptional({
    required: false,
    enum: USER_MEDIA_HISTORY_STATES,
    description: 'Narrow history to a single state (must be one of HISTORY_STATES).',
  })
  @IsOptional()
  @IsIn(USER_MEDIA_HISTORY_STATES)
  state?: UserMediaHistoryState;
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

  @ApiPropertyOptional({
    type: ProgressSummaryDto,
    nullable: true,
    description: 'Episode progress summary (only for shows)',
  })
  progressSummary?: ProgressSummaryDto | null;

  @ApiPropertyOptional({
    type: ContinuePointDto,
    nullable: true,
    description: 'Next episode to continue watching (only for shows with progress)',
  })
  continuePoint?: ContinuePointDto | null;
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

/**
 * Aggregated counts for user's lists (activity + saved).
 * Used to render tab badges without fetching full list payloads.
 *
 * Shape mirrors {@link UserListCounts} from the domain layer — the class
 * implements that interface so any shape drift between the domain model and
 * its HTTP contract surfaces as a TypeScript error.
 */
export class MeListCountsResponseDto implements UserListCounts {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Items with state=watching (strict, no overlap with paused/dropped)',
  })
  watching!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Items paused by the user' })
  paused!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Items dropped by the user' })
  dropped!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Items the user completed watching' })
  completed!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Items caught up on (ongoing shows with all aired episodes watched)',
  })
  caughtUp!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Saved items in the "for later" list',
  })
  forLater!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Saved items in the "considering" list',
  })
  considering!: number;
}
