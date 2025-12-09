import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { HomeService } from '../application/home.service';
import { MediaType } from '../../../common/enums/media-type.enum';

describe('HomeController', () => {
  let controller: HomeController;
  let homeServiceMock: any;

  beforeEach(async () => {
    homeServiceMock = {
      getHero: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: HomeService,
          useValue: homeServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHero', () => {
    it('should return data from service', async () => {
      const mockData = [{ id: '1', title: 'Test' }];
      homeServiceMock.getHero.mockResolvedValue(mockData);

      const result = await controller.getHero();

      expect(homeServiceMock.getHero).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockData);
    });

    it('should pass type parameter to service', async () => {
      await controller.getHero(MediaType.MOVIE);
      expect(homeServiceMock.getHero).toHaveBeenCalledWith(MediaType.MOVIE);
    });
  });
});
