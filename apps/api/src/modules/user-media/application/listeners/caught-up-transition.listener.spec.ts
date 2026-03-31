import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import type { IUserMediaStateRepository } from '../../domain/repositories/user-media-state.repository.interface';
import type { UserMediaService } from '../user-media.service';

import { CaughtUpTransitionListener } from './caught-up-transition.listener';

describe('CaughtUpTransitionListener', () => {
  let listener: CaughtUpTransitionListener;
  let repo: jest.Mocked<Pick<IUserMediaStateRepository, 'findByMediaAndState'>>;
  let userMediaService: jest.Mocked<Pick<UserMediaService, 'setState'>>;

  beforeEach(() => {
    repo = {
      findByMediaAndState: jest.fn().mockResolvedValue([]),
    };
    userMediaService = {
      setState: jest.fn().mockResolvedValue(undefined),
    };
    listener = new CaughtUpTransitionListener(repo as any, userMediaService as any);
  });

  it('should transition all caught_up users to watching', async () => {
    repo.findByMediaAndState.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(repo.findByMediaAndState).toHaveBeenCalledWith('media-1', USER_MEDIA_STATE.CAUGHT_UP);
    expect(userMediaService.setState).toHaveBeenCalledTimes(3);
    expect(userMediaService.setState).toHaveBeenCalledWith({
      userId: 'user-1',
      mediaItemId: 'media-1',
      state: USER_MEDIA_STATE.WATCHING,
    });
    expect(userMediaService.setState).toHaveBeenCalledWith({
      userId: 'user-2',
      mediaItemId: 'media-1',
      state: USER_MEDIA_STATE.WATCHING,
    });
    expect(userMediaService.setState).toHaveBeenCalledWith({
      userId: 'user-3',
      mediaItemId: 'media-1',
      state: USER_MEDIA_STATE.WATCHING,
    });
  });

  it('should do nothing when no caught_up users exist', async () => {
    repo.findByMediaAndState.mockResolvedValue([]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(userMediaService.setState).not.toHaveBeenCalled();
  });

  it('should continue processing remaining users when one fails', async () => {
    repo.findByMediaAndState.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);
    userMediaService.setState
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined as any);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(userMediaService.setState).toHaveBeenCalledTimes(3);
    // user-1 and user-3 succeeded, user-2 failed — but all were attempted
    expect(userMediaService.setState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(userMediaService.setState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: 'user-2' }),
    );
    expect(userMediaService.setState).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ userId: 'user-3' }),
    );
  });

  it('should not call setState when findByMediaAndState fails', async () => {
    repo.findByMediaAndState.mockRejectedValue(new Error('DB error'));

    await listener.handle({ mediaItemId: 'media-1' });

    expect(userMediaService.setState).not.toHaveBeenCalled();
  });

  it('should handle single user', async () => {
    repo.findByMediaAndState.mockResolvedValue([{ userId: 'user-1' }]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(userMediaService.setState).toHaveBeenCalledTimes(1);
    expect(userMediaService.setState).toHaveBeenCalledWith({
      userId: 'user-1',
      mediaItemId: 'media-1',
      state: USER_MEDIA_STATE.WATCHING,
    });
  });
});
