import { Logger } from '@nestjs/common';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { type MonitoredProvider } from '../../domain/constants/monitored-provider.const';
import { type KeyProbe, type KeyProbeResult } from '../../domain/ports/key-probe.port';

export abstract class BaseKeyProbe implements KeyProbe {
  abstract readonly provider: MonitoredProvider;
  protected readonly logger = new Logger(this.constructor.name);

  protected abstract execute(): Promise<KeyProbeResult>;

  async probe(): Promise<KeyProbeResult> {
    const start = Date.now();
    try {
      const result = await this.execute();
      return { ...result, latencyMs: result.latencyMs ?? Date.now() - start };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Probe threw unexpectedly';
      this.logger.warn(`Probe for ${this.provider} failed: ${detail}`);
      return { status: API_KEY_STATUS.UNKNOWN, latencyMs: Date.now() - start, detail };
    }
  }
}
