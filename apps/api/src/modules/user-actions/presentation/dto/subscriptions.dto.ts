import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  SUBSCRIPTION_TRIGGER,
  SubscriptionTrigger,
} from '../../domain/entities/user-subscription.entity';

const SUBSCRIPTION_TRIGGER_VALUES = Object.values(SUBSCRIPTION_TRIGGER);

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
  context?: string;
}

/**
 * Response DTO for subscription.
 */
export class SubscriptionResponseDto {
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

/**
 * Response DTO for subscription with media.
 */
export class SubscriptionWithMediaResponseDto extends SubscriptionResponseDto {
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
