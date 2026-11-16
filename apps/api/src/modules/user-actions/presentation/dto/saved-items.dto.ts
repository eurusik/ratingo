import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { MAX_PAGE_SIZE } from '@/common/constants';
import { OffsetPaginationMetaDto, OffsetPaginationQueryDto } from '@/common/dtos';
import { ImageDto } from '@/common/dtos/image.dto';
import { MediaType } from '@/common/enums/media-type.enum';
import {
  SAVED_ITEM_LIST,
  type SavedItemList,
} from '@/modules/user-actions/domain/entities/user-saved-item.entity';

const SAVED_ITEM_LIST_VALUES = Object.values(SAVED_ITEM_LIST);

/**
 * DTO for saving an item.
 */
export class SaveItemDto {
  @ApiProperty({
    enum: SAVED_ITEM_LIST_VALUES,
    example: 'for_later',
    description: 'List to save to: for_later or considering',
  })
  @IsIn(SAVED_ITEM_LIST_VALUES)
  list: SavedItemList;

  @ApiProperty({ example: 'verdict', required: false, description: 'Where the action originated' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    example: 'trendingNow',
    required: false,
    description: 'Verdict/reason that triggered the action',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reasonKey?: string;
}

/**
 * DTO for unsaving an item.
 */
export class UnsaveItemDto {
  @ApiProperty({
    enum: SAVED_ITEM_LIST_VALUES,
    example: 'for_later',
    description: 'List to remove from',
  })
  @IsIn(SAVED_ITEM_LIST_VALUES)
  list: SavedItemList;

  @ApiProperty({ example: 'card', required: false })
  @IsOptional()
  @IsString()
  context?: string;
}

/**
 * Response DTO for saved item.
 */
class SavedItemResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ enum: SAVED_ITEM_LIST_VALUES, example: 'for_later' })
  list: SavedItemList;

  @ApiProperty({
    type: String,
    example: 'trendingNow',
    required: false,
    nullable: true,
    description: 'Verdict/reason that triggered the save action',
  })
  reasonKey: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}

export class SavedItemMediaSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: [MediaType.MOVIE, MediaType.SHOW] })
  type: MediaType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: ImageDto, nullable: true })
  poster: ImageDto | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  releaseDate?: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  qualityScore?: number | null;
}

/**
 * Response DTO for saved item with media.
 */
export class SavedItemWithMediaResponseDto extends SavedItemResponseDto {
  @ApiProperty({ type: SavedItemMediaSummaryDto })
  mediaSummary: SavedItemMediaSummaryDto;

  @ApiProperty({
    example: ['release', 'new_season'],
    description:
      'Active subscription triggers for this media item. Empty array if no subscriptions.',
    type: [String],
  })
  activeSubscriptionTriggers: string[];
}

export class PaginatedSavedItemsResponseDto {
  @ApiProperty({ type: SavedItemWithMediaResponseDto, isArray: true })
  data: SavedItemWithMediaResponseDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}

/**
 * Response DTO for media save status with boolean flags.
 */
export class MediaSaveStatusDto {
  @ApiProperty({ example: true, description: 'Is saved in "for later" list' })
  isForLater: boolean;

  @ApiProperty({ example: false, description: 'Is saved in "considering" list' })
  isConsidering: boolean;
}

/**
 * Response DTO for save action result.
 */
export class SaveActionResultDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ enum: ['for_later', 'considering'], example: 'for_later' })
  list: SavedItemList;

  @ApiProperty({ description: 'Current save status after action' })
  status: MediaSaveStatusDto;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}

/**
 * Response DTO for unsave action result.
 */
export class UnsaveActionResultDto {
  @ApiProperty({ example: true })
  removed: boolean;

  @ApiProperty({ description: 'Current save status after action' })
  status: MediaSaveStatusDto;
}

/**
 * Query DTO for batch status request.
 */
export class BatchStatusQueryDto {
  @ApiProperty({
    example: 'id1,id2,id3',
    description: `Comma-separated list of media item UUIDs (max ${MAX_PAGE_SIZE})`,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_PAGE_SIZE)
  ids: string[];
}

/**
 * Response DTO for batch status.
 */
export class BatchStatusResponseDto {
  @ApiProperty({
    example: {
      id1: { isForLater: true, isConsidering: false },
      id2: { isForLater: false, isConsidering: true },
    },
    description: 'Map of mediaItemId to save status',
  })
  statuses: Record<string, MediaSaveStatusDto>;
}

/**
 * Query DTO for listing saved items with optional media type filter.
 */
export class SavedItemsListQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    required: false,
    enum: MediaType,
    description: 'Filter by media type',
  })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}
