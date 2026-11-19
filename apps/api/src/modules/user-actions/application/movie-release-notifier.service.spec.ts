import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { type ClaimedMovieRelease } from '../domain/repositories/user-subscription.repository.interface';

import { MovieReleaseNotifier } from './movie-release-notifier.service';

const NOW = new Date('2026-11-19T06:00:00Z');

const claimed = (overrides: Partial<ClaimedMovieRelease> = {}): ClaimedMovieRelease => ({
  id: 'sub-1',
  userId: 'user-1',
  mediaItemId: 'movie-1',
  release: { releasedOn: new Date('2026-11-18T00:00:00Z'), kind: 'theatrical', country: 'US' },
  ...overrides,
});

function setup() {
  const subscriptionRepo = {
    claimMovieReleases: jest.fn().mockResolvedValue([]),
    releaseClaims: jest.fn().mockResolvedValue(undefined),
  };
  const notificationRepo = { createMany: jest.fn().mockResolvedValue(1) };
  const notifier = new MovieReleaseNotifier(subscriptionRepo as never, notificationRepo as never, {
    now: () => NOW,
  });
  const claimFor = (trigger: string, rows: ClaimedMovieRelease[]) =>
    subscriptionRepo.claimMovieReleases.mockImplementation(async (t: string) =>
      t === trigger ? rows : [],
    );
  return { notifier, subscriptionRepo, notificationRepo, claimFor };
}

describe('MovieReleaseNotifier', () => {
  it('looks back three days and up to the end of today, never just today', async () => {
    const { notifier, subscriptionRepo } = setup();

    await notifier.notifyMovieReleases();

    const window = {
      from: new Date('2026-11-16T00:00:00Z'),
      toExclusive: new Date('2026-11-20T00:00:00Z'),
    };
    expect(subscriptionRepo.claimMovieReleases).toHaveBeenNthCalledWith(
      1,
      SUBSCRIPTION_TRIGGER.ON_STREAMING,
      window,
    );
    expect(subscriptionRepo.claimMovieReleases).toHaveBeenNthCalledWith(
      2,
      SUBSCRIPTION_TRIGGER.RELEASE,
      window,
    );
  });

  it('creates no notifications when nothing was released', async () => {
    const { notifier, notificationRepo } = setup();

    await expect(notifier.notifyMovieReleases()).resolves.toBe(0);
    expect(notificationRepo.createMany).not.toHaveBeenCalled();
  });

  it('stores the release date, kind and country of each claimed subscription', async () => {
    const { notifier, notificationRepo, claimFor } = setup();
    claimFor(SUBSCRIPTION_TRIGGER.RELEASE, [claimed()]);

    await notifier.notifyMovieReleases();

    expect(notificationRepo.createMany).toHaveBeenCalledWith([
      {
        userId: 'user-1',
        mediaItemId: 'movie-1',
        subscriptionId: 'sub-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        payload: {
          airDate: '2026-11-18T00:00:00.000Z',
          releaseKind: 'theatrical',
          releaseCountry: 'US',
        },
      },
    ]);
  });

  it('stores digital releases before claiming cinema releases', async () => {
    const { notifier, subscriptionRepo, notificationRepo, claimFor } = setup();
    claimFor(SUBSCRIPTION_TRIGGER.ON_STREAMING, [claimed()]);

    await notifier.notifyMovieReleases();

    const [stored] = notificationRepo.createMany.mock.invocationCallOrder;
    const [, releaseClaim] = subscriptionRepo.claimMovieReleases.mock.invocationCallOrder;
    expect(stored).toBeLessThan(releaseClaim!);
  });

  it('hands the claims back when notifications cannot be stored, so a retry sends them', async () => {
    const { notifier, subscriptionRepo, notificationRepo, claimFor } = setup();
    claimFor(SUBSCRIPTION_TRIGGER.RELEASE, [claimed()]);
    notificationRepo.createMany.mockRejectedValue(new Error('insert failed'));

    await expect(notifier.notifyMovieReleases()).rejects.toThrow('insert failed');
    expect(subscriptionRepo.releaseClaims).toHaveBeenCalledWith(['sub-1']);
  });

  it('reports the insert failure even when handing the claims back fails too', async () => {
    const { notifier, subscriptionRepo, notificationRepo, claimFor } = setup();
    claimFor(SUBSCRIPTION_TRIGGER.RELEASE, [claimed()]);
    notificationRepo.createMany.mockRejectedValue(new Error('insert failed'));
    subscriptionRepo.releaseClaims.mockRejectedValue(new Error('connection lost'));

    await expect(notifier.notifyMovieReleases()).rejects.toThrow('insert failed');
  });

  it('sends one notification per subscription across repeated runs', async () => {
    const { notifier, subscriptionRepo, notificationRepo } = setup();
    const notified = new Set<string>();
    subscriptionRepo.claimMovieReleases.mockImplementation(async (trigger: string) => {
      if (trigger !== SUBSCRIPTION_TRIGGER.RELEASE || notified.has('sub-1')) return [];
      notified.add('sub-1');
      return [claimed()];
    });

    await expect(notifier.notifyMovieReleases()).resolves.toBe(1);
    await expect(notifier.notifyMovieReleases()).resolves.toBe(0);
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);
  });
});
