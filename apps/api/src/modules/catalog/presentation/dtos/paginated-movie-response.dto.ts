import { ApiProperty } from '@nestjs/swagger';
import { MovieListItemDto } from './movie-list-item.dto';
import { OffsetPaginationMetaDto } from './pagination.dto';

export class PaginatedMovieResponseDto {
  @ApiProperty({ type: [MovieListItemDto] })
  data: MovieListItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}
