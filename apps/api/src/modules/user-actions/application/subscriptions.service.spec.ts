import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories/user-subscription.repository.interface';
import { USER_MEDIA_ACTION_REPOSITORY } from '../domain/repositories/user-media-action.repository.interface';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';
import { SHOW_STATE_PORT } from '../domain/ports/show-state.port';
import { USER_PREFERENCE_PORT } from '../domain/ports/user-preference.port';
import { MOVIE_RELEASE_PORT } from '../domain/ports/movie-release.port';
import { CLOCK_PORT } from '@/modules/shared/clock';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: any;
  let actionRepo: any;
  let showStatePort: any;
  let userPreferencePort: any;
  let movieReleasePort: any;

  const mockSubscription = {
    id: 'sub-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    trigger: SUBSCRIPTION_TRIGGER.RELEASE,
    channel: 'push',
    isActive: true,
    lastNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscriptionWithMedia = {
    ...mockSubscription,
    mediaSummary: {
      id: 'media-id-1',
      type: 'movie',
      title: 'Inception',
      slug: 'inception-2010',
      poster: null,
    },
  };

  beforeEach(async () => {
    subscriptionRepo = {
      upsert: jest.fn().mockResolvedValue(mockSubscription),
      deactivate: jest.fn().mockResolvedValue(true),
      findActiveTriggersForMedia: jest.fn().mockResolvedValue([SUBSCRIPTION_TRIGGER.RELEASE]),
      listActiveWithMedia: jest.fn().mockResolvedValue([mockSubscriptionWithMedia]),
      countActive: jest.fn().mockResolvedValue(1),
      findTriggersClosedToAutoPlan: jest.fn().mockResolvedValue([]),
      deactivateAbandonedAutoPlan: jest.fn().mockResolvedValue([]),
      activateAutoPlan: jest.fn().mockResolvedValue(true),
    };

    movieReleasePort = {
      findMovieReleaseSchedule: jest.fn().mockResolvedValue(null),
    };

    actionRepo = {
      create: jest.fn().mockResolvedValue({ id: 'action-id-1' }),
    };

    showStatePort = {
      getLastAiredEpisodeKey: jest.fn().mockResolvedValue(null),
      findShowPremiereFacts: jest.fn().mockResolvedValue(null),
    };

    userPreferencePort = {
      getAutoSubscribeOnWatch: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
        { provide: USER_MEDIA_ACTION_REPOSITORY, useValue: actionRepo },
        { provide: SHOW_STATE_PORT, useValue: showStatePort },
        { provide: USER_PREFERENCE_PORT, useValue: userPreferencePort },
        { provide: MOVIE_RELEASE_PORT, useValue: movieReleasePort },
        { provide: CLOCK_PORT, useValue: { now: () => new Date('2026-11-19T06:00:00Z') } },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('subscribe', () => {
    it('should create subscription and log action', async () => {
      const result = await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
      });

      expect(result).toEqual(mockSubscription);
      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
      });
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.SUBSCRIBE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
        payload: { trigger: SUBSCRIPTION_TRIGGER.RELEASE },
      });
    });

    it('should initialize dedup markers for new_season trigger', async () => {
      showStatePort.getLastAiredEpisodeKey.mockResolvedValueOnce('S2E10');

      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });

      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        lastNotifiedSeasonNumber: 2,
      });
    });

    it('should initialize dedup markers for new_episode trigger', async () => {
      showStatePort.getLastAiredEpisodeKey.mockResolvedValueOnce('S3E5');

      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
      });

      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
        lastNotifiedEpisodeKey: 'S3E5',
      });
    });

    it('should set season marker to 0 when no episodes exist', async () => {
      showStatePort.getLastAiredEpisodeKey.mockResolvedValueOnce(null);

      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });

      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        lastNotifiedSeasonNumber: 0,
      });
    });

    it('keeps a subscription manual even when its context reads auto-plan', async () => {
      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'auto-plan',
      });

      expect(subscriptionRepo.upsert).toHaveBeenCalledTimes(1);
      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });

    it('should not fetch show state for non-show triggers', async () => {
      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
      });

      expect(showStatePort.getLastAiredEpisodeKey).not.toHaveBeenCalled();
      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
      });
    });
  });

  describe('premiere bell', () => {
    it('marks a manual premiere bell on an aired show as past the premiere so it never fires', async () => {
      showStatePort.getLastAiredEpisodeKey.mockResolvedValueOnce('S1E4');

      await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'show-1',
        trigger: SUBSCRIPTION_TRIGGER.PREMIERE,
      });

      expect(subscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: SUBSCRIPTION_TRIGGER.PREMIERE,
          lastNotifiedEpisodeKey: 'S1E4',
        }),
      );
    });
  });

  describe('unsubscribe', () => {
    it('should deactivate subscription and log action when deactivated', async () => {
      const result = await service.unsubscribe(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
        'card',
      );

      expect(result).toBe(true);
      expect(subscriptionRepo.deactivate).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.UNSUBSCRIBE,
        context: 'card',
        payload: { trigger: SUBSCRIPTION_TRIGGER.RELEASE },
      });
    });

    it('should not log action when subscription not found', async () => {
      subscriptionRepo.deactivate.mockResolvedValue(false);

      const result = await service.unsubscribe(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).toBe(false);
      expect(actionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getActiveTriggersForMedia', () => {
    it('should return active triggers for media', async () => {
      const result = await service.getActiveTriggersForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual([SUBSCRIPTION_TRIGGER.RELEASE]);
      expect(subscriptionRepo.findActiveTriggersForMedia).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
      );
    });
  });

  describe('listActiveWithMedia', () => {
    it('should return paginated subscriptions with media', async () => {
      const result = await service.listActiveWithMedia('user-id-1', 20, 0);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].mediaSummary.title).toBe('Inception');
      expect(subscriptionRepo.countActive).toHaveBeenCalledWith('user-id-1');
      expect(subscriptionRepo.listActiveWithMedia).toHaveBeenCalledWith('user-id-1', 20, 0);
    });
  });

  describe('autoSubscribeForShow', () => {
    it('should subscribe to new_season and new_episode when preference is enabled', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValueOnce(true);
      subscriptionRepo.findActiveTriggersForMedia.mockResolvedValueOnce([]);

      await service.autoSubscribeForShow('user-id-1', 'media-id-1');

      expect(subscriptionRepo.upsert).toHaveBeenCalledTimes(2);
      expect(subscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        }),
      );
      expect(subscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
        }),
      );
    });

    it('should skip when user preference is disabled', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValueOnce(false);

      await service.autoSubscribeForShow('user-id-1', 'media-id-1');

      expect(subscriptionRepo.upsert).not.toHaveBeenCalled();
    });

    it('should not duplicate already active subscriptions', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValueOnce(true);
      subscriptionRepo.findActiveTriggersForMedia.mockResolvedValueOnce([
        SUBSCRIPTION_TRIGGER.NEW_SEASON,
      ]);

      await service.autoSubscribeForShow('user-id-1', 'media-id-1');

      expect(subscriptionRepo.upsert).toHaveBeenCalledTimes(1);
      expect(actionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE },
        }),
      );
    });

    it('should not subscribe when both triggers already active', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValueOnce(true);
      subscriptionRepo.findActiveTriggersForMedia.mockResolvedValueOnce([
        SUBSCRIPTION_TRIGGER.NEW_SEASON,
        SUBSCRIPTION_TRIGGER.NEW_EPISODE,
      ]);

      await service.autoSubscribeForShow('user-id-1', 'media-id-1');

      expect(subscriptionRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('autoSubscribeForPremiere', () => {
    const awaiting = {
      firstAirDate: new Date('2027-02-10T00:00:00Z'),
      status: 'Planned',
      hasAiredEpisode: false,
    };

    beforeEach(() => {
      showStatePort.findShowPremiereFacts.mockResolvedValue(awaiting);
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
    });

    it('turns on the premiere reminder as an automatic plan reminder and logs it', async () => {
      await service.autoSubscribeForPremiere('user-id-1', 'show-1');

      expect(showStatePort.findShowPremiereFacts).toHaveBeenCalledWith(
        'show-1',
        new Date('2026-11-19T06:00:00Z'),
      );
      expect(subscriptionRepo.activateAutoPlan).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'show-1',
        trigger: SUBSCRIPTION_TRIGGER.PREMIERE,
      });
      expect(actionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: USER_MEDIA_ACTION.SUBSCRIBE,
          context: 'auto-plan',
          payload: { trigger: SUBSCRIPTION_TRIGGER.PREMIERE },
        }),
      );
    });

    it('logs nothing when another request already turned it on', async () => {
      subscriptionRepo.activateAutoPlan.mockResolvedValue(false);

      await service.autoSubscribeForPremiere('user-id-1', 'show-1');

      expect(actionRepo.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a show that is already out', { ...awaiting, hasAiredEpisode: true }],
      ['a movie or unknown media', null],
    ])('does nothing for %s', async (_case, facts) => {
      showStatePort.findShowPremiereFacts.mockResolvedValue(facts);

      await service.autoSubscribeForPremiere('user-id-1', 'show-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });

    it('respects the auto-subscribe preference', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(false);

      await service.autoSubscribeForPremiere('user-id-1', 'show-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });

    it('leaves the reminder alone when it is active or the user turned it off', async () => {
      subscriptionRepo.findTriggersClosedToAutoPlan.mockResolvedValue([
        SUBSCRIPTION_TRIGGER.PREMIERE,
      ]);

      await service.autoSubscribeForPremiere('user-id-1', 'show-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });
  });

  describe('autoSubscribeForMovie', () => {
    const upcoming = {
      theatricalReleaseDate: new Date('2026-12-18T00:00:00Z'),
      digitalReleaseDate: null,
      releaseDate: null,
    };

    const subscribedTriggers = () =>
      subscriptionRepo.activateAutoPlan.mock.calls.map((call: any[]) => call[0].trigger);

    it('subscribes to the digital release first and the cinema release second', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue(upcoming);

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscribedTriggers()).toEqual([
        SUBSCRIPTION_TRIGGER.ON_STREAMING,
        SUBSCRIPTION_TRIGGER.RELEASE,
      ]);
      expect(actionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: USER_MEDIA_ACTION.SUBSCRIBE, context: 'auto-plan' }),
      );
      expect(subscriptionRepo.upsert).not.toHaveBeenCalled();
    });

    it('respects the auto-subscribe preference', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(false);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue(upcoming);

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });

    it('does nothing for shows and unknown media', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue(null);

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });

    it('subscribes only to the digital release of a movie already in cinemas', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue({
        ...upcoming,
        theatricalReleaseDate: new Date('2026-11-01T00:00:00Z'),
      });

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscribedTriggers()).toEqual([SUBSCRIPTION_TRIGGER.ON_STREAMING]);
    });

    it('skips triggers that are active or that the user turned off', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue(upcoming);
      subscriptionRepo.findTriggersClosedToAutoPlan.mockResolvedValue([
        SUBSCRIPTION_TRIGGER.ON_STREAMING,
      ]);

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscribedTriggers()).toEqual([SUBSCRIPTION_TRIGGER.RELEASE]);
    });

    it('subscribes to nothing for a movie that is fully out', async () => {
      userPreferencePort.getAutoSubscribeOnWatch.mockResolvedValue(true);
      movieReleasePort.findMovieReleaseSchedule.mockResolvedValue({
        theatricalReleaseDate: new Date('2026-08-01T00:00:00Z'),
        digitalReleaseDate: new Date('2026-10-01T00:00:00Z'),
        releaseDate: null,
      });

      await service.autoSubscribeForMovie('user-id-1', 'media-id-1');

      expect(subscriptionRepo.activateAutoPlan).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeAbandonedAutoPlan', () => {
    it('logs an automatic unsubscribe for every dropped trigger', async () => {
      subscriptionRepo.deactivateAbandonedAutoPlan.mockResolvedValue([
        SUBSCRIPTION_TRIGGER.ON_STREAMING,
        SUBSCRIPTION_TRIGGER.RELEASE,
      ]);

      await service.unsubscribeAbandonedAutoPlan('user-id-1', 'media-id-1');

      expect(subscriptionRepo.deactivateAbandonedAutoPlan).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
      );
      expect(actionRepo.create.mock.calls.map((call: any[]) => call[0])).toEqual([
        expect.objectContaining({
          action: USER_MEDIA_ACTION.UNSUBSCRIBE,
          context: 'auto-plan',
          payload: { trigger: SUBSCRIPTION_TRIGGER.ON_STREAMING },
        }),
        expect.objectContaining({
          action: USER_MEDIA_ACTION.UNSUBSCRIBE,
          context: 'auto-plan',
          payload: { trigger: SUBSCRIPTION_TRIGGER.RELEASE },
        }),
      ]);
    });

    it('logs nothing when the movie is still planned', async () => {
      await service.unsubscribeAbandonedAutoPlan('user-id-1', 'media-id-1');

      expect(actionRepo.create).not.toHaveBeenCalled();
    });
  });
});
