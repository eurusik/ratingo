import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import { MONITORING_QUEUE, MONITORING_JOBS } from '../../monitoring.constants';
import { KeyHealthService } from '../services/key-health.service';

@Processor(MONITORING_QUEUE, { concurrency: 1 })
export class MonitoringWorker extends WorkerHost {
  private readonly logger = new Logger(MonitoringWorker.name);

  constructor(private readonly keyHealthService: KeyHealthService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MONITORING_JOBS.CHECK_KEYS:
        await this.keyHealthService.runChecks();
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }
}
