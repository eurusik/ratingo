import { ApiProperty } from '@nestjs/swagger';

import { ImageDto } from '../../../../common/dtos/image.dto';

export class PersonResponseDto {
  @ApiProperty({ example: 287 })
  tmdbId: number;

  @ApiProperty({ example: 'brad-pitt' })
  slug: string;

  @ApiProperty({ example: 'Brad Pitt' })
  name: string;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  profile?: ImageDto | null;

  @ApiProperty({ example: 'Acting', required: false, nullable: true })
  knownForDepartment?: string | null;

  @ApiProperty({
    example: 'An American actor and film producer...',
    required: false,
    nullable: true,
  })
  biography?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  birthday?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  deathday?: Date | null;

  @ApiProperty({ example: 'Shawnee, Oklahoma, USA', required: false, nullable: true })
  placeOfBirth?: string | null;

  @ApiProperty({ example: 12.34 })
  popularity: number;
}
