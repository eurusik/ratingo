import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CatalogListQueryDto } from './catalog-list-query.dto';

export class CatalogListQueryWithDaysDto extends CatalogListQueryDto {
  @ApiPropertyOptional({ default: 30, description: 'Days to look back' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  daysBack?: number = 30;
}
