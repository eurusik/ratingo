import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import type { Queue } from 'bullmq';

import type { AgentFolder, TaskDefinition } from '@ratingo/ai-core';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import {
  DIGEST_JOB_OPTIONS,
  DIGEST_JOB_TYPES,
  DIGEST_QUEUE_TOKEN,
  DIGEST_TASK_NAME,
} from '../../digest.constants';

@Injectable()
export class DigestSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(DIGEST_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerScheduledTasks();
    await this.removeOrphans();
  }

  private scheduledTasks(): TaskDefinition[] {
    return this.folder.tasks.filter((task) => task.frontmatter.schedule !== undefined);
  }

  private async registerScheduledTasks(): Promise<void> {
    const task = this.scheduledTasks().find((candidate) => candidate.name === DIGEST_TASK_NAME);
    if (task === undefined) {
      return;
    }
    await this.queue.upsertJobScheduler(
      DIGEST_TASK_NAME,
      { pattern: task.frontmatter.schedule, tz: task.frontmatter.timezone },
      { name: DIGEST_JOB_TYPES.DAILY_DIGEST, data: {}, opts: { ...DIGEST_JOB_OPTIONS } },
    );
    this.logger.log(
      `Розклад «${task.name}»: ${task.frontmatter.schedule} ${task.frontmatter.timezone}`,
    );
  }

  private async removeOrphans(): Promise<void> {
    const known = new Set(this.scheduledTasks().map((task) => task.name));
    const schedulers = await this.queue.getJobSchedulers();
    for (const scheduler of schedulers) {
      if (!known.has(scheduler.key)) {
        await this.queue.removeJobScheduler(scheduler.key);
        this.logger.warn(`Прибрано застарілий розклад ${scheduler.key}`);
      }
    }
  }
}
