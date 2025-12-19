import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { SAVED_ITEM_LIST, SavedItemList } from '../../domain/entities/user-saved-item.entity';

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
export class SavedItemResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ enum: SAVED_ITEM_LIST_VALUES, example: 'for_later' })
  list: SavedItemList;

  @ApiProperty({
    example: 'trendingNow',
    required: false,
    nullable: true,
    description: 'Verdict/reason that triggered the save action',
  })
  reasonKey: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}

/**
 * Response DTO for saved item with media.
 */
export class SavedItemWithMediaResponseDto extends SavedItemResponseDto {
  @ApiProperty({
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'movie',
      title: 'Inception',
      slug: 'inception-2010',
      poster: { w92: '...', w185: '...', w342: '...', w500: '...', w780: '...', original: '...' },
    },
  })
  mediaSummary: {
    id: string;
    type: string;
    title: string;
    slug: string;
    poster: Record<string, string> | null;
    releaseDate?: Date | null;
  };

  @ApiProperty({
    example: ['release', 'new_season'],
    description:
      'Active subscription triggers for this media item. Empty array if no subscriptions.',
    type: [String],
  })
  activeSubscriptionTriggers: string[];
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
    description: 'Comma-separated list of media item UUIDs (max 100)',
  })
  @IsString()
  ids: string;
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
