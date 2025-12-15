import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

const STATES = ['watching', 'completed', 'planned', 'dropped'] as const;
type State = (typeof STATES)[number];

/**
 * Payload for setting user media state.
 */
export class SetUserMediaStateDto {
  /**
   * State of the media for the user.
   */
  @ApiProperty({ enum: STATES, example: 'watching' })
  @IsIn(STATES)
  state: State;

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
