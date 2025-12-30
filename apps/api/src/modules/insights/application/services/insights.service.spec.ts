import { Test, TestingModule } from '@nestjs/testing';
import { InsightsService } from './insights.service';
import { INSIGHTS_REPOSITORY } from '../../domain/repositories/insights.repository.interface';
import { RiseFallQuery } from '../types/insights.types';

describe('InsightsService', () => {
  let service: InsightsService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      getMovements: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InsightsService, { provide: INSIGHTS_REPOSITORY, useValue: repository }],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMovements', () => {
    it('should map window parameter correctly and return data', async () => {
      const mockResult = { risers: [], fallers: [] };
      repository.getMovements.mockResolvedValue(mockResult);

      const query: RiseFallQuery = { window: '90d', limit: 10 };
      const result = await service.getMovements(query);

      expect(repository.getMovements).toHaveBeenCalledWith(90, 10);
      expect(result).toEqual({
        window: '90d',
        region: 'global',
        metric: 'delta',
        risers: [],
        fallers: [],
      });
    });

    it('should use default window days for unknown window', async () => {
      const mockResult = { risers: [], fallers: [] };
      repository.getMovements.mockResolvedValue(mockResult);

      const query: RiseFallQuery = { window: '30d', limit: 5 };
      const result = await service.getMovements(query);

      expect(repository.getMovements).toHaveBeenCalledWith(30, 5);
      expect(result.window).toBe('30d');
    });
  });
});
