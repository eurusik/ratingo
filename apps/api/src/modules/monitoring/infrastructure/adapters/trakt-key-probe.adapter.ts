import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { ResilientHttpClient } from '@/common/http/resilient-http.client';
import traktConfig from '@/config/trakt.config';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

import { BaseKeyProbe } from './base-key-probe';
import { PROBE_RETRY_CONFIG, mapHttpFailure } from './probe-http.util';

@Injectable()
export class TraktKeyProbe extends BaseKeyProbe {
  readonly provider = MONITORED_PROVIDER.TRAKT;
  private readonly http = new ResilientHttpClient(PROBE_RETRY_CONFIG);

  constructor(
    @Inject(traktConfig.KEY)
    private readonly config: ConfigType<typeof traktConfig>,
  ) {
    super();
  }

  protected async execute(): Promise<KeyProbeResult> {
    if (!this.config.clientId) {
      return { status: API_KEY_STATUS.UNKNOWN, detail: 'TRAKT_CLIENT_ID not configured' };
    }

    const url = `${this.config.apiUrl}/movies/trending?limit=1`;
    const result = await this.http.get(url, {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId,
      'User-Agent': this.config.userAgent,
    });

    return result.success ? { status: API_KEY_STATUS.VALID } : mapHttpFailure(result);
  }
}
