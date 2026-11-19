import { type Job } from 'bullmq';

import { USER_NOTIFICATIONS_JOB } from '@/modules/user-actions/user-actions.constants';
import { type MovieReleaseNotifier } from '../movie-release-notifier.service';

import { UserNotificationsWorker } from './user-notifications.worker';

describe('UserNotificationsWorker', () => {
  it('runs the movie release notifier for its job', async () => {
    const notifier = { notifyMovieReleases: jest.fn().mockResolvedValue(0) };
    const worker = new UserNotificationsWorker(notifier as unknown as MovieReleaseNotifier);

    await worker.process({ name: USER_NOTIFICATIONS_JOB.NOTIFY_MOVIE_RELEASES } as Job);

    expect(notifier.notifyMovieReleases).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown jobs', async () => {
    const notifier = { notifyMovieReleases: jest.fn() };
    const worker = new UserNotificationsWorker(notifier as unknown as MovieReleaseNotifier);

    await worker.process({ name: 'something-else' } as Job);

    expect(notifier.notifyMovieReleases).not.toHaveBeenCalled();
  });
});
