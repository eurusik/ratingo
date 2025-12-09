import { ApiProperty } from '@nestjs/swagger';
import { MediaBaseDto } from './common.dto';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';

export class MovieResponseDto extends MediaBaseDto {
  @ApiProperty({ example: 120, required: false, nullable: true })
  runtime?: number | null;

  @ApiProperty({ example: 100000000, required: false, nullable: true })
  budget?: number | null;

  @ApiProperty({ example: 500000000, required: false, nullable: true })
  revenue?: number | null;

  @ApiProperty({ 
    enum: MovieStatus,
    example: MovieStatus.RELEASED,
    description: 'Movie status: Rumored, Planned, In Production, Post Production, Released, Canceled',
    required: false, 
    nullable: true,
  })
  status?: MovieStatus | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  releaseDate: Date | null;
}
