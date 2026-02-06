import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  USER_MEDIA_STATE,
  USER_MEDIA_STATE_VALUES,
  type UserMediaState,
} from '../../domain/entities/user-media-state.entity';

@ValidatorConstraint({ name: 'atLeastOneField' })
class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as SetUserMediaStateDto;
    return (
      obj.state !== undefined ||
      obj.rating !== undefined ||
      obj.progress !== undefined ||
      obj.notes !== undefined
    );
  }

  defaultMessage() {
    return 'At least one field (state, rating, progress, or notes) must be provided';
  }
}

/**
 * Payload for setting user media state.
 */
export class SetUserMediaStateDto {
  /**
   * Dummy property for class-level validation.
   * Ensures at least one meaningful field (state, rating, progress, or notes) is present.
   */
  @ApiHideProperty()
  @Validate(AtLeastOneFieldConstraint)
  private readonly _validate?: never;

  /**
   * State of the media for the user.
   */
  @ApiProperty({
    enum: USER_MEDIA_STATE_VALUES,
    example: USER_MEDIA_STATE.WATCHING,
    required: false,
    description:
      'Watch state. When omitted, preserves existing state or defaults to "completed" for movies / "watching" for shows.',
  })
  @IsOptional()
  @IsIn(USER_MEDIA_STATE_VALUES)
  state?: UserMediaState['state'];

  @ApiProperty({
    enum: MediaType,
    required: false,
    description:
      'Media type hint for auto-state resolution. Only accepted when state is omitted; ignored otherwise.',
  })
  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  /**
   * Optional rating (0-100).
   */
  @ApiProperty({ example: null, required: false, nullable: true, minimum: 0, maximum: 100 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  rating?: number | null;

  /**
   * Optional progress payload.
   */
  @ApiProperty({
    example: { seasons: { 1: 3 } },
    required: false,
    description: 'Season -> episode progress map',
  })
  @IsOptional()
  @IsObject()
  progress?: {
    seasons?: Record<number, number>;
  } | null;

  /**
   * Optional notes.
   */
  @ApiProperty({ example: 'Rewatching with friends', required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;
}
