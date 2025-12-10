import { ApiProperty } from '@nestjs/swagger';
import { MovieListItemDto } from './movie-list-item.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  count: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;
}

export class PaginatedMovieResponseDto {
  @ApiProperty({ type: [MovieListItemDto] })
  data: MovieListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
