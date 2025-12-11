import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from '../../application/services/insights.service';
import { InsightsQueryDto, RiseFallResponseDto } from '../../presentation/dtos/insights.dto';

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
    it('should call service and return movements', async () => {
      const query: InsightsQueryDto = { window: '30d', limit: 10 };
      const expectedResult: RiseFallResponseDto = {
        window: '30d',
        region: 'global',
        metric: 'delta',
        risers: [],
        fallers: [],
      };

      service.getMovements.mockResolvedValue(expectedResult);

      const result = await controller.getMovements(query);

      expect(service.getMovements).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });
});
