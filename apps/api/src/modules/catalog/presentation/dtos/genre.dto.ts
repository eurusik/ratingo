import { ApiProperty } from '@nestjs/swagger';

export class GenreDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Action' })
  name: string;

  @ApiProperty({ example: 'action' })
  slug: string;
}
