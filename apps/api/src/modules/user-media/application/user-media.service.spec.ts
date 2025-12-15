import { UserMediaService } from './user-media.service';

describe('UserMediaService', () => {
  const repo = {
    upsert: jest.fn(),
    findOne: jest.fn(),
    findOneWithMedia: jest.fn(),
    listByUser: jest.fn(),
    listWithMedia: jest.fn(),
    findManyByMediaIds: jest.fn(),
  };

  const cards = {
    enrichUserMedia: jest.fn((items: any[]) => items),
  };

  let service: UserMediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserMediaService(repo as any, cards as any);
  });

  it('setState should delegate to repo.upsert', async () => {
    repo.upsert.mockResolvedValue({ id: 's1' } as any);

    const result = await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: 'watching',
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalled();
    expect(result).toEqual({ id: 's1' });
  });

  it('getStateWithMedia should delegate to repo.findOneWithMedia', async () => {
    repo.findOneWithMedia.mockResolvedValue({ id: 's1', mediaSummary: { poster: null } } as any);

    const result = await service.getStateWithMedia('u1', 'm1');

    expect(repo.findOneWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1', mediaSummary: { poster: null } });
  });

  it('listWithMedia should delegate to repo.listWithMedia', async () => {
    repo.listWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await service.listWithMedia('u1', 20, 0);

    expect(repo.listWithMedia).toHaveBeenCalledWith('u1', 20, 0, undefined);
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('findMany should delegate to repo.findManyByMediaIds', async () => {
    repo.findManyByMediaIds.mockResolvedValue([{ id: 's1', mediaItemId: 'm1' }] as any);

    const result = await service.findMany('u1', ['m1']);

    expect(repo.findManyByMediaIds).toHaveBeenCalledWith('u1', ['m1']);
    expect(result).toEqual([{ id: 's1', mediaItemId: 'm1' }]);
  });
});
