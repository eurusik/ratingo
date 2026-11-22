import type { HappyConfig } from '../../../../config/config.constants';
import { HappyProbe } from '../../domain/entities/happy-probe';
import type { HappyHealthPort } from '../../domain/ports/watchdog.ports';
import { HAPPY_HEALTH_PATH, HAPPY_HEALTH_TIMEOUT_MS } from '../../watchdog.constants';

const TRAILING_SLASHES = /\/+$/;

export class HttpHappyHealthAdapter implements HappyHealthPort {
  constructor(
    private readonly config: Pick<HappyConfig, 'internalUrl'>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async probe(): Promise<HappyProbe> {
    if (this.config.internalUrl === undefined) return HappyProbe.SKIPPED;
    const url = `${this.config.internalUrl.replace(TRAILING_SLASHES, '')}${HAPPY_HEALTH_PATH}`;
    try {
      const response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(HAPPY_HEALTH_TIMEOUT_MS),
      });
      return response.ok ? HappyProbe.UP : HappyProbe.DOWN;
    } catch {
      return HappyProbe.DOWN;
    }
  }
}
