import { ApiProperty } from '@nestjs/swagger';

import { OffsetPaginationMetaDto } from '../../../../common/dtos';

import { MovieListItemDto } from './movie-list-item.dto';

export class PaginatedMovieResponseDto {
  @ApiProperty({ type: [MovieListItemDto] })
  data: MovieListItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}
