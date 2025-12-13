import { Test, TestingModule } from '@nestjs/testing';
import { CatalogSearchController } from './catalog.search.controller';
import { CatalogSearchService } from '../../application/services/catalog-search.service';

describe('CatalogSearchController', () => {
  let controller: CatalogSearchController;

  const catalogSearchService = {
    search: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogSearchController],
      providers: [{ provide: CatalogSearchService, useValue: catalogSearchService }],
    }).compile();

    controller = module.get(CatalogSearchController);
    jest.clearAllMocks();
  });

  it('should delegate search to service', async () => {
    catalogSearchService.search.mockResolvedValue({ query: 'mo', local: [], tmdb: [] });

    const res = await controller.search('mo');

    expect(catalogSearchService.search).toHaveBeenCalledWith('mo');
    expect(res).toEqual({ query: 'mo', local: [], tmdb: [] });
  });
});
