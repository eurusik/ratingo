import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { MEDIA_REPOSITORY } from '../../catalog/domain/repositories/media.repository.interface';
import { MediaType } from '../../../common/enums/media-type.enum';

describe('HomeService', () => {
  let service: HomeService;
  let mediaRepositoryMock: any;

  beforeEach(async () => {
    mediaRepositoryMock = {
      findHero: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: MEDIA_REPOSITORY,
          useValue: mediaRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHero', () => {
    const mockHeroItems = [
      { 
        id: '1', 
        title: 'Movie 1', 
        type: MediaType.MOVIE, 
        primaryTrailerKey: 'key1',
        isNew: true,
        isClassic: false,
      },
      { 
        id: '2', 
        title: 'Show 1', 
        type: MediaType.SHOW,
        showProgress: { season: 1, episode: 1, label: 'S1E1' },
        isNew: false,
        isClassic: true,
      },
    ];

    it('should return hero items from repository with default limit 3', async () => {
      mediaRepositoryMock.findHero.mockResolvedValue(mockHeroItems);

      const result = await service.getHero();

      expect(mediaRepositoryMock.findHero).toHaveBeenCalledWith(3, undefined);
      expect(result).toEqual(mockHeroItems);
      expect(result[1].showProgress).toBeDefined();
    });

    it('should pass type parameter to repository', async () => {
      mediaRepositoryMock.findHero.mockResolvedValue([mockHeroItems[0]]);

      const result = await service.getHero(MediaType.MOVIE);

      expect(mediaRepositoryMock.findHero).toHaveBeenCalledWith(3, MediaType.MOVIE);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(MediaType.MOVIE);
    });

    it('should return empty array on repository error', async () => {
      mediaRepositoryMock.findHero.mockRejectedValue(new Error('DB Error'));

      const result = await service.getHero();

      expect(result).toEqual([]);
    });
  });
});
