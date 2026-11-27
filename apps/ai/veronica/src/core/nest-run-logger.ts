import { Logger } from '@nestjs/common';
import type { RunLogger } from '@ratingo/ai-core';

export class NestRunLogger implements RunLogger {
  private readonly logger = new Logger('Run');

  info(event: string, fields: Record<string, unknown>): void {
    this.logger.log({ ...fields, message: event });
  }
}
