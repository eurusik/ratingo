import { ApiProperty } from '@nestjs/swagger';
import { MediaBaseDto } from './common.dto';

export class MovieResponseDto extends MediaBaseDto {
  @ApiProperty({ example: 120, required: false, nullable: true })
  runtime?: number | null;

  @ApiProperty({ example: 100000000, required: false, nullable: true })
  budget?: number | null;

  @ApiProperty({ example: 500000000, required: false, nullable: true })
  revenue?: number | null;

  @ApiProperty({ example: 'Released', required: false, nullable: true })
  status?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  releaseDate: Date | null;
}
