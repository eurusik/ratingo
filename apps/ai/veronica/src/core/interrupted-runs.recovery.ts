import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  markInterruptedRuns,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { AGENT_FOLDER } from './ai-core.constants';

@Injectable()
export class InterruptedRunsRecovery implements OnModuleInit {
  private readonly logger = new Logger(InterruptedRunsRecovery.name);

  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async onModuleInit(): Promise<void> {
    const interrupted = await markInterruptedRuns(this.folder.manifest.name, this.runs, this.clock);
    if (interrupted > 0) {
      this.logger.warn(`Позначено перерваними запуски після рестарту: ${interrupted}`);
    }
  }
}
