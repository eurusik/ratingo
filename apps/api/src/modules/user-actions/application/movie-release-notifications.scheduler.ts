import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { type Queue } from 'bullmq';

import { errorMessage } from '@/common/utils/error.utils';
import schedulerConfig from '@/config/scheduler.config';

import {
  MOVIE_RELEASE_NOTIFICATIONS_PATTERN,
  MOVIE_RELEASE_NOTIFICATIONS_SCHEDULER_ID,
  USER_NOTIFICATIONS_JOB,
  USER_NOTIFICATIONS_QUEUE,
} from '../user-actions.constants';

@Injectable()
export class MovieReleaseNotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(MovieReleaseNotificationsScheduler.name);

  constructor(
    @InjectQueue(USER_NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    @Inject(schedulerConfig.KEY) private readonly config: ConfigType<typeof schedulerConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Scheduler DISABLED: movie release notifications not registered');
      return;
    }

    const schedulerId = `${this.config.envPrefix}:${MOVIE_RELEASE_NOTIFICATIONS_SCHEDULER_ID}`;
    try {
      await this.queue.upsertJobScheduler(
        schedulerId,
        { pattern: MOVIE_RELEASE_NOTIFICATIONS_PATTERN, tz: this.config.timezone },
        { name: USER_NOTIFICATIONS_JOB.NOTIFY_MOVIE_RELEASES, data: {} },
      );
      this.logger.log(
        `[${schedulerId}] ${MOVIE_RELEASE_NOTIFICATIONS_PATTERN} ${this.config.timezone}`,
      );
    } catch (error) {
      this.logger.error(`Failed to register ${schedulerId}: ${errorMessage(error)}`);
    }
  }
}
