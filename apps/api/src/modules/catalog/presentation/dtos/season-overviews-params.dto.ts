import { ApiProperty } from '@nestjs/swagger';

import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const MAX_SEASON_NUMBER = 500;
const MAX_SLUG_LENGTH = 255;

export class SeasonOverviewsParamsDto {
  @ApiProperty({ example: 'shetland', maxLength: MAX_SLUG_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SLUG_LENGTH)
  slug: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: MAX_SEASON_NUMBER })
  @IsInt()
  @Min(0)
  @Max(MAX_SEASON_NUMBER)
  seasonNumber: number;
}
