import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';

import { CatalogImportService } from '../../application/services/catalog-import.service';
import { CatalogSearchService } from '../../application/services/catalog-search.service';
import { SEARCH_SOURCE } from '../../domain/types/search.types';

import { CatalogSearchController } from './catalog.search.controller';

describe('CatalogSearchController', () => {
  let controller: CatalogSearchController;

  const catalogSearchService = {
    search: jest.fn(),
  };

  const catalogImportService = {
    importMedia: jest.fn(),
    getImportJobStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogSearchController],
      providers: [
        { provide: CatalogSearchService, useValue: catalogSearchService },
        { provide: CatalogImportService, useValue: catalogImportService },
      ],
    }).compile();

    controller = module.get(CatalogSearchController);
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should call service and map results to DTO', async () => {
      const domainResult = {
        query: 'matrix',
        local: [
          {
            source: SEARCH_SOURCE.LOCAL,
            type: MediaType.MOVIE,
            id: 'uuid-1',
            slug: 'the-matrix',
            tmdbId: 603,
            title: 'The Matrix',
            originalTitle: 'The Matrix',
            year: 1999,
            posterPath: '/poster.jpg',
            rating: 8.7,
          },
        ],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 604,
            title: 'Matrix Reloaded',
            originalTitle: 'The Matrix Reloaded',
            year: 2003,
            posterPath: '/poster2.jpg',
            rating: 7.0,
          },
        ],
      };
      catalogSearchService.search.mockResolvedValue(domainResult);

      const result = await controller.search('matrix');

      expect(catalogSearchService.search).toHaveBeenCalledWith('matrix');

      // Verify mapper added isImported and poster URLs
      expect(result.local[0].isImported).toBe(true);
      expect(result.local[0].poster).toEqual({
        small: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        medium: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        large: 'https://image.tmdb.org/t/p/w780/poster.jpg',
        original: 'https://image.tmdb.org/t/p/original/poster.jpg',
      });

      expect(result.tmdb[0].isImported).toBe(false);
      expect(result.tmdb[0].poster).toBeDefined();
    });

    it('should return empty arrays for empty query', async () => {
      catalogSearchService.search.mockResolvedValue({ query: '', local: [], tmdb: [] });

      const result = await controller.search('');

      expect(result).toEqual({ query: '', local: [], tmdb: [] });
    });
  });
});
