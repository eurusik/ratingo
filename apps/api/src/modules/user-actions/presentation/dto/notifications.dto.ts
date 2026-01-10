import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ nullable: true })
  poster: { small: string; medium: string; large: string } | null;
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
