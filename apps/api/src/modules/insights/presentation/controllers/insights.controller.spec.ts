import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from '../../application/services/insights.service';
import { InsightsQueryDto, RiseFallResponseDto } from '../dtos/insights.dto';

describe('InsightsController', () => {
  let controller: InsightsController;
  let service: any;

  beforeEach(async () => {
    service = {
      getMovements: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [{ provide: InsightsService, useValue: service }],
    }).compile();

    controller = module.get<InsightsController>(InsightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMovements', () => {
    it('should convert DTO to query and return movements', async () => {
      const dto: InsightsQueryDto = { window: '30d', limit: 10 };
      const expectedResult: RiseFallResponseDto = {
        window: '30d',
        region: 'global',
        metric: 'delta',
        risers: [],
        fallers: [],
      };

      service.getMovements.mockResolvedValue(expectedResult);

      const result = await controller.getMovements(dto);

      expect(service.getMovements).toHaveBeenCalledWith({ window: '30d', limit: 10 });
      expect(result).toEqual(expectedResult);
    });

    it('should use defaults when DTO has no values', async () => {
      const dto: InsightsQueryDto = {};
      const expectedResult: RiseFallResponseDto = {
        window: '30d',
        region: 'global',
        metric: 'delta',
        risers: [],
        fallers: [],
      };

      service.getMovements.mockResolvedValue(expectedResult);

      const result = await controller.getMovements(dto);

      expect(service.getMovements).toHaveBeenCalledWith({ window: '30d', limit: 5 });
      expect(result).toEqual(expectedResult);
    });
  });
});
