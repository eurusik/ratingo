import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { type Queue } from 'bullmq';

import schedulerConfig, { getMonitoringKeyHealthOverride } from '@/config/scheduler.config';

import {
  KEY_HEALTH_CHECK_PATTERN,
  KEY_HEALTH_SCHEDULER_ID,
  MONITORING_JOBS,
  MONITORING_QUEUE,
} from '../../monitoring.constants';

@Injectable()
export class MonitoringSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringSchedulerService.name);

  constructor(
    @InjectQueue(MONITORING_QUEUE) private readonly queue: Queue,
    @Inject(schedulerConfig.KEY) private readonly config: ConfigType<typeof schedulerConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Scheduler DISABLED — key-health probe not registered');
      return;
    }

    const override = getMonitoringKeyHealthOverride();
    if (!override.enabled) {
      this.logger.log('Key-health probe DISABLED via env override');
      return;
    }

    const pattern = override.pattern ?? KEY_HEALTH_CHECK_PATTERN;
    const schedulerId = `${this.config.envPrefix}:${KEY_HEALTH_SCHEDULER_ID}`;

    try {
      await this.queue.upsertJobScheduler(
        schedulerId,
        { pattern, tz: this.config.timezone },
        {
          name: MONITORING_JOBS.CHECK_KEYS,
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 50 },
        },
      );
      this.logger.log(`Key-health probe scheduled: ${pattern} ${this.config.timezone}`);
    } catch (error) {
      this.logger.error(`Failed to register key-health scheduler: ${String(error)}`);
    }
  }
}
