import { BadRequestException } from '@nestjs/common';
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

  it('setState should auto-upgrade state to watching when progress is provided', async () => {
    repo.upsert.mockResolvedValue({ id: 's1' } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: 'planned',
      rating: null,
      progress: { seasons: { 1: 3 } },
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'watching',
        progress: { seasons: { 1: 3 } },
      }),
    );
  });

  it('setState should reject progress for completed state', async () => {
    await expect(
      service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'completed',
        rating: null,
        progress: { seasons: { 1: 3 } },
        notes: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('setState should reject progress for dropped state', async () => {
    await expect(
      service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'dropped',
        rating: null,
        progress: { seasons: { 1: 3 } },
        notes: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('setState should auto-upgrade paused state to watching when progress is provided', async () => {
    repo.upsert.mockResolvedValue({ id: 's1', state: 'watching' } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: 'paused',
      rating: null,
      progress: { seasons: { 1: 5 } },
      notes: null,
    });

    // Same behavior as planned - progress implies watching
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'watching',
        progress: { seasons: { 1: 5 } },
      }),
    );
  });

  it('setState should allow paused state without progress', async () => {
    repo.upsert.mockResolvedValue({ id: 's1', state: 'paused' } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: 'paused',
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'paused',
        progress: null,
      }),
    );
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

  describe('pauseMedia', () => {
    it('should pause a watching media item', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: 'watching' } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: 'paused' } as any);

      const result = await service.pauseMedia('u1', 'm1');

      expect(repo.upsert).toHaveBeenCalledWith({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'paused',
      });
      expect(result.state).toBe('paused');
    });

    it('should throw BadRequestException when no state exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when item is not watching', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: 'completed' } as any);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when item is already paused', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: 'paused' } as any);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('resumeMedia', () => {
    it('should resume a paused media item', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: 'paused' } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: 'watching' } as any);

      const result = await service.resumeMedia('u1', 'm1');

      expect(repo.upsert).toHaveBeenCalledWith({
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'watching',
      });
      expect(result.state).toBe('watching');
    });

    it('should throw BadRequestException when no state exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.resumeMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when item is not paused', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: 'watching' } as any);

      await expect(service.resumeMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });
});
