import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { ImageDto } from '@/common/dtos';

const MAX_ANTICIPATED_SHOWS = 50;

export class AnticipatedShowsQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_ANTICIPATED_SHOWS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ANTICIPATED_SHOWS)
  @Type(() => Number)
  limit: number = DEFAULT_PAGE_SIZE;
}

export class AnticipatedShowDto {
  @ApiProperty({ type: String, format: 'uuid' })
  mediaItemId: string;

  @ApiProperty({ type: String, example: 'harry-potter' })
  slug: string;

  @ApiProperty({ type: String, example: 'Гаррі Поттер' })
  title: string;

  @ApiProperty({ type: ImageDto })
  poster: ImageDto;

  @ApiProperty({ type: Date, description: 'First air date of the show.' })
  premiereDate: Date;

  @ApiProperty({
    type: Number,
    example: 60000,
    description: 'Number of Trakt lists the show is on.',
  })
  listCount: number;
}

export class AnticipatedShowsResponseDto {
  @ApiProperty({ type: [AnticipatedShowDto] })
  data: AnticipatedShowDto[];
}
