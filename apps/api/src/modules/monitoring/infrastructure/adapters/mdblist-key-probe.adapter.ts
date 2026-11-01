import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { ResilientHttpClient } from '@/common/http/resilient-http.client';
import mdblistConfig from '@/config/mdblist.config';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

import { BaseKeyProbe } from './base-key-probe';
import { PROBE_RETRY_CONFIG, mapHttpFailure } from './probe-http.util';

const PROBE_TMDB_MOVIE_ID = 550;

@Injectable()
export class MdblistKeyProbe extends BaseKeyProbe {
  readonly provider = MONITORED_PROVIDER.MDBLIST;
  private readonly http = new ResilientHttpClient(PROBE_RETRY_CONFIG);

  constructor(
    @Inject(mdblistConfig.KEY)
    private readonly config: ConfigType<typeof mdblistConfig>,
  ) {
    super();
  }

  protected async execute(): Promise<KeyProbeResult> {
    if (!this.config.apiKey) {
      return { status: API_KEY_STATUS.UNKNOWN, detail: 'MDBLIST_API_KEY not configured' };
    }

    const url = new URL(`${this.config.apiUrl}/tmdb/movie/${PROBE_TMDB_MOVIE_ID}`);
    url.searchParams.set('apikey', this.config.apiKey);

    const result = await this.http.get(url.toString());
    return result.success ? { status: API_KEY_STATUS.VALID } : mapHttpFailure(result);
  }
}
