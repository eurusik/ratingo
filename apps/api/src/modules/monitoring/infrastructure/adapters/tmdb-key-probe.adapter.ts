import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { ResilientHttpClient } from '@/common/http/resilient-http.client';
import tmdbConfig from '@/config/tmdb.config';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

import { BaseKeyProbe } from './base-key-probe';
import { PROBE_RETRY_CONFIG, mapHttpFailure } from './probe-http.util';

@Injectable()
export class TmdbKeyProbe extends BaseKeyProbe {
  readonly provider = MONITORED_PROVIDER.TMDB;
  private readonly http = new ResilientHttpClient(PROBE_RETRY_CONFIG);

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
  ) {
    super();
  }

  protected async execute(): Promise<KeyProbeResult> {
    if (!this.config.apiKey) {
      return { status: API_KEY_STATUS.UNKNOWN, detail: 'TMDB_API_KEY not configured' };
    }

    const url = new URL(`${this.config.apiUrl}/configuration`);
    url.searchParams.set('api_key', this.config.apiKey);

    const result = await this.http.get(url.toString());
    return result.success ? { status: API_KEY_STATUS.VALID } : mapHttpFailure(result);
  }
}
