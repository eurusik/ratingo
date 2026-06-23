import { ApiProperty } from '@nestjs/swagger';

import { ImageDto } from '../../../../common/dtos/image.dto';
import { OffsetPaginationMetaDto } from '../../../../common/dtos/pagination.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';

export class PersonCreditItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ enum: MediaType, example: MediaType.MOVIE })
  type: MediaType;

  @ApiProperty({ example: 550 })
  tmdbId: number;

  @ApiProperty({ example: 'Fight Club' })
  title: string;

  @ApiProperty({ example: 'fight-club' })
  slug: string;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  releaseDate: Date | null;

  @ApiProperty({ example: 0.87, required: false, nullable: true })
  ratingoScore: number | null;

  @ApiProperty({
    example: 'Tyler Durden',
    nullable: true,
    description: 'Cast character on this title, if the person acted in it',
  })
  character: string | null;

  @ApiProperty({
    type: [String],
    example: ['Director'],
    description: 'Crew jobs on this title (e.g. Director, Creator); empty if none',
  })
  jobs: string[];
}

export class PaginatedPersonCreditsResponseDto {
  @ApiProperty({ type: [PersonCreditItemDto] })
  data: PersonCreditItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}
