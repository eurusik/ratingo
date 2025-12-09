import { ApiProperty } from '@nestjs/swagger';
import { MovieResponseDto } from './movie-response.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  count: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;
}

export class PaginatedMovieResponseDto {
  @ApiProperty({ type: [MovieResponseDto] })
  data: MovieResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
