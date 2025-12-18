import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiProperty } from '@nestjs/swagger';
import { CatalogSearchService } from '../../application/services/catalog-search.service';
import { CatalogImportService } from '../../application/services/catalog-import.service';
import { ImportResult, ImportStatus } from '../../domain/types/import.types';
import { SearchResponseDto } from '../dtos/search.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

class ImportResultDto implements ImportResult {
  @ApiProperty({ enum: ImportStatus })
  status: ImportStatus;

  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  slug?: string;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiProperty()
  tmdbId: number;

  @ApiProperty({ required: false, enum: IngestionStatus })
  ingestionStatus?: IngestionStatus;
}

/**
 * Public catalog search endpoints.
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog')
export class CatalogSearchController {
  constructor(
    private readonly catalogSearchService: CatalogSearchService,
    private readonly catalogImportService: CatalogImportService,
  ) {}

  /**
   * Searches movies and shows.
   *
   * @param {string} query - Search string
   * @returns {Promise<SearchResponseDto>} Search results
   */
  @Get('search')
  @ApiOperation({ summary: 'Search movies and shows' })
  @ApiResponse({ status: 200, type: SearchResponseDto })
  async search(@Query('query') query: string): Promise<SearchResponseDto> {
    return this.catalogSearchService.search(query);
  }

  /**
   * Triggers on-demand import of a movie from TMDB.
   * Creates a stub and queues for full sync.
   */
  @Post('import/movie/:tmdbId')
  @ApiOperation({ summary: 'Import a movie from TMDB on-demand' })
  @ApiParam({ name: 'tmdbId', type: Number })
  @ApiResponse({ status: 202, type: ImportResultDto })
  @HttpCode(HttpStatus.ACCEPTED)
  async importMovie(@Param('tmdbId') tmdbId: string): Promise<ImportResult> {
    return this.catalogImportService.importMedia(parseInt(tmdbId, 10), MediaType.MOVIE);
  }

  /**
   * Triggers on-demand import of a show from TMDB.
   * Creates a stub and queues for full sync.
   */
  @Post('import/show/:tmdbId')
  @ApiOperation({ summary: 'Import a show from TMDB on-demand' })
  @ApiParam({ name: 'tmdbId', type: Number })
  @ApiResponse({ status: 202, type: ImportResultDto })
  @HttpCode(HttpStatus.ACCEPTED)
  async importShow(@Param('tmdbId') tmdbId: string): Promise<ImportResult> {
    return this.catalogImportService.importMedia(parseInt(tmdbId, 10), MediaType.SHOW);
  }

  /**
   * Checks import status of a media item by TMDB ID.
   * Used for polling during import.
   */
  @Get('import/status/:tmdbId')
  @ApiOperation({ summary: 'Check import status by TMDB ID' })
  @ApiParam({ name: 'tmdbId', type: Number })
  @ApiResponse({ status: 200, type: ImportResultDto })
  async checkImportStatus(@Param('tmdbId') tmdbId: string): Promise<ImportResult | null> {
    return this.catalogImportService.checkStatus(parseInt(tmdbId, 10));
  }
}
