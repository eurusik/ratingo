import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsIn, IsNotIn, IsOptional, IsString } from 'class-validator';

import { ImageDto } from '@/common/dtos/image.dto';
import { MediaType } from '@/common/enums/media-type.enum';
import { SUBSCRIPTION_CONTEXT } from '@/modules/user-actions/domain/constants/subscription.constants';
import {
  SUBSCRIPTION_TRIGGER,
  type SubscriptionTrigger,
} from '@/modules/user-actions/domain/entities/user-subscription.entity';

const SUBSCRIPTION_TRIGGER_VALUES = Object.values(SUBSCRIPTION_TRIGGER);
const SYSTEM_CONTEXTS = Object.values(SUBSCRIPTION_CONTEXT);

/**
 * DTO for subscribing to notifications.
 */
export class SubscribeDto {
  @ApiProperty({
    enum: SUBSCRIPTION_TRIGGER_VALUES,
    example: 'release',
    description: 'Trigger type: release, new_season, or on_streaming',
  })
  @IsIn(SUBSCRIPTION_TRIGGER_VALUES)
  trigger: SubscriptionTrigger;

  @ApiProperty({ example: 'verdict', required: false, description: 'Where the action originated' })
  @IsOptional()
  @IsString()
  @IsNotIn(SYSTEM_CONTEXTS)
  context?: string;

  @ApiProperty({
    example: 'upcomingHit',
    required: false,
    description: 'Verdict/reason that triggered the action',
  })
  @IsOptional()
  @IsString()
  reasonKey?: string;
}

/**
 * DTO for unsubscribing from notifications.
 */
export class UnsubscribeDto {
  @ApiProperty({
    enum: SUBSCRIPTION_TRIGGER_VALUES,
    example: 'release',
    description: 'Trigger type to unsubscribe from',
  })
  @IsIn(SUBSCRIPTION_TRIGGER_VALUES)
  trigger: SubscriptionTrigger;

  @ApiProperty({ example: 'card', required: false })
  @IsOptional()
  @IsString()
  @IsNotIn(SYSTEM_CONTEXTS)
  context?: string;
}

/**
 * Response DTO for subscription.
 */
class SubscriptionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ enum: SUBSCRIPTION_TRIGGER_VALUES, example: 'release' })
  trigger: SubscriptionTrigger;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}

export class SubscriptionMediaSummaryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ enum: [MediaType.MOVIE, MediaType.SHOW], example: MediaType.MOVIE })
  type: MediaType;

  @ApiProperty({ example: 'Inception' })
  title: string;

  @ApiProperty({ example: 'inception-2010' })
  slug: string;

  @ApiProperty({ type: ImageDto, nullable: true })
  poster: ImageDto | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  releaseDate?: Date | null;
}

/**
 * Response DTO for subscription with media.
 */
export class SubscriptionWithMediaResponseDto extends SubscriptionResponseDto {
  @ApiProperty({ type: SubscriptionMediaSummaryDto })
  mediaSummary: SubscriptionMediaSummaryDto;
}

/**
 * Response DTO for media subscription status with boolean flags.
 */
export class MediaSubscriptionStatusDto {
  @ApiProperty({ example: ['release'], description: 'Active subscription triggers' })
  triggers: SubscriptionTrigger[];

  @ApiProperty({ example: true, description: 'Has active release subscription' })
  hasRelease: boolean;

  @ApiProperty({ example: false, description: 'Has active new season subscription' })
  hasNewSeason: boolean;

  @ApiProperty({ example: false, description: 'Has active on streaming subscription' })
  hasOnStreaming: boolean;
}

/**
 * Response DTO for subscribe action result.
 */
export class SubscribeActionResultDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ enum: SUBSCRIPTION_TRIGGER_VALUES, example: 'release' })
  trigger: SubscriptionTrigger;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Current subscription status after action' })
  status: MediaSubscriptionStatusDto;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}

/**
 * Response DTO for unsubscribe action result.
 */
export class UnsubscribeActionResultDto {
  @ApiProperty({ example: true })
  unsubscribed: boolean;

  @ApiProperty({ description: 'Current subscription status after action' })
  status: MediaSubscriptionStatusDto;
}
