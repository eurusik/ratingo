import { Logger } from '@nestjs/common';

import type { RunLogger } from '@ratingo/ai-core';

export class NestSpendLogger {
  private readonly logger = new Logger('Spend');

  warn(message: string): void {
    this.logger.warn(message);
  }
}

export class NestRunLogger implements RunLogger {
  private readonly logger = new Logger('Run');

  info(event: string, fields: Record<string, unknown>): void {
    this.logger.log(`${event} ${JSON.stringify(fields)}`);
  }
}
