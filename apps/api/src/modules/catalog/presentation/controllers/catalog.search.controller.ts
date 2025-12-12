import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogSearchService } from '../../application/services/catalog-search.service';
import { SearchResponseDto } from '../dtos/search.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';

@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog')
export class CatalogSearchController {
  constructor(private readonly catalogSearchService: CatalogSearchService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search movies and shows' })
  @ApiResponse({ status: 200, type: SearchResponseDto })
  async search(@Query('query') query: string): Promise<SearchResponseDto> {
    return this.catalogSearchService.search(query);
  }
}
