import { ApiProperty } from '@nestjs/swagger';

import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

const MAX_SEASON_NUMBER = 500;

export class SeasonOverviewsParamsDto {
  @ApiProperty({ example: 'shetland' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: MAX_SEASON_NUMBER })
  @IsInt()
  @Min(0)
  @Max(MAX_SEASON_NUMBER)
  seasonNumber: number;
}
