import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { ImageDto } from '../../../../common/dtos/image.dto';
import { OffsetPaginationQueryDto } from '../../../../common/dtos/pagination.dto';

/**
 * Query parameters for notification list endpoint.
 */
export class NotificationListQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by unread only' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  unread?: boolean;
}

/**
 * Media summary in notification response.
 */
export class NotificationMediaSummaryDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'show', enum: ['movie', 'show'] })
  type: string;

  @ApiProperty({ example: 'Breaking Bad' })
  title: string;

  @ApiProperty({ example: 'breaking-bad' })
  slug: string;

  @ApiProperty({ type: ImageDto, nullable: true })
  poster: ImageDto | null;
}

/**
 * Notification payload.
 */
export class NotificationPayloadDto {
  @ApiProperty({ example: 3, required: false })
  seasonNumber?: number;

  @ApiProperty({ example: 'S3E1', required: false })
  episodeKey?: string;

  @ApiProperty({ example: '2025-01-15', required: false })
  airDate?: string;
}

/**
 * Single notification in list response.
 */
export class NotificationItemDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({
    example: 'new_season',
    enum: ['release', 'new_season', 'new_episode', 'on_streaming', 'status_changed'],
  })
  trigger: string;

  @ApiProperty({ type: NotificationPayloadDto, nullable: true })
  payload: NotificationPayloadDto | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: NotificationMediaSummaryDto })
  mediaSummary: NotificationMediaSummaryDto;
}

/**
 * Response for notification list endpoint.
 */
export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  data: NotificationItemDto[];

  @ApiProperty({ example: 5 })
  unreadCount: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

/**
 * Response for unread count endpoint.
 */
export class UnreadCountResponseDto {
  @ApiProperty({ example: 5 })
  unreadCount: number;
}

/**
 * Response for mark as read endpoints.
 */
export class MarkReadResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 3, required: false })
  count?: number;
}
