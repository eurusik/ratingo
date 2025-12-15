import { Test, TestingModule } from '@nestjs/testing';
import { UserMediaController } from './user-media.controller';
import { UserMediaService } from '../../application/user-media.service';

describe('UserMediaController', () => {
  let controller: UserMediaController;
  const userMediaService = {
    getStateWithMedia: jest.fn(),
    setState: jest.fn(),
    listWithMedia: jest.fn(),
    listContinueWithMedia: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserMediaController],
      providers: [{ provide: UserMediaService, useValue: userMediaService }],
    }).compile();

    controller = module.get(UserMediaController);
    jest.clearAllMocks();
  });

  it('getState should call service.getStateWithMedia', async () => {
    userMediaService.getStateWithMedia.mockResolvedValue({ id: 's1' } as any);

    const result = await controller.getState({ id: 'u1' }, 'm1');

    expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1' });
  });

  it('setState should upsert with null fallbacks and return updated state with media', async () => {
    userMediaService.setState.mockResolvedValue({ id: 's1' } as any);
    userMediaService.getStateWithMedia.mockResolvedValue({
      id: 's1',
      mediaSummary: { poster: null },
    } as any);

    const body = {
      state: 'watching',
      rating: undefined,
      progress: undefined,
      notes: undefined,
    };

    const result = await controller.setState({ id: 'u1' }, 'm1', body as any);

    expect(userMediaService.setState).toHaveBeenCalledWith({
      userId: 'u1',
      mediaItemId: 'm1',
      state: 'watching',
      rating: null,
      progress: null,
      notes: null,
    });
    expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1', mediaSummary: { poster: null } });
  });

  it('list should parse limit/offset and call service.listWithMedia', async () => {
    userMediaService.listWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await controller.list({ id: 'u1' }, '10' as any, '5' as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith('u1', 10, 5);
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('listContinue should parse limit/offset and call service.listContinueWithMedia', async () => {
    userMediaService.listContinueWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await controller.listContinue({ id: 'u1' }, '10' as any, '5' as any);

    expect(userMediaService.listContinueWithMedia).toHaveBeenCalledWith('u1', 10, 5);
    expect(result).toEqual([{ id: 's1' }]);
  });
});
