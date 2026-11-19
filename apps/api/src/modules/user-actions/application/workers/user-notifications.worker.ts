import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import {
  USER_NOTIFICATIONS_JOB,
  USER_NOTIFICATIONS_QUEUE,
} from '@/modules/user-actions/user-actions.constants';

import { MovieReleaseNotifier } from '../movie-release-notifier.service';

@Processor(USER_NOTIFICATIONS_QUEUE, { concurrency: 1 })
export class UserNotificationsWorker extends WorkerHost {
  private readonly logger = new Logger(UserNotificationsWorker.name);

  constructor(private readonly movieReleaseNotifier: MovieReleaseNotifier) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case USER_NOTIFICATIONS_JOB.NOTIFY_MOVIE_RELEASES:
        await this.movieReleaseNotifier.notifyMovieReleases();
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }
}
