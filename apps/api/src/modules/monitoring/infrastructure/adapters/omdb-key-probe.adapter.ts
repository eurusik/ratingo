import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { ResilientHttpClient } from '@/common/http/resilient-http.client';
import omdbConfig from '@/config/omdb.config';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

import { BaseKeyProbe } from './base-key-probe';
import { PROBE_RETRY_CONFIG, mapHttpFailure } from './probe-http.util';

const PROBE_IMDB_ID = 'tt0111161';

interface OmdbProbeResponse {
  Response?: string;
  Error?: string;
}

@Injectable()
export class OmdbKeyProbe extends BaseKeyProbe {
  readonly provider = MONITORED_PROVIDER.OMDB;
  private readonly http = new ResilientHttpClient(PROBE_RETRY_CONFIG);

  constructor(
    @Inject(omdbConfig.KEY)
    private readonly config: ConfigType<typeof omdbConfig>,
  ) {
    super();
  }

  protected async execute(): Promise<KeyProbeResult> {
    if (!this.config.apiKey) {
      return { status: API_KEY_STATUS.UNKNOWN, detail: 'OMDB_API_KEY not configured' };
    }

    const url = new URL(this.config.apiUrl);
    url.searchParams.set('apikey', this.config.apiKey);
    url.searchParams.set('i', PROBE_IMDB_ID);

    const result = await this.http.get<OmdbProbeResponse>(url.toString());
    if (!result.success) {
      return mapHttpFailure(result);
    }

    const body = result.data;
    if (body?.Response === 'False') {
      const detail = body.Error ?? 'OMDb rejected the request';
      const isKeyError = /api key/i.test(body.Error ?? '');
      return { status: isKeyError ? API_KEY_STATUS.INVALID : API_KEY_STATUS.UNKNOWN, detail };
    }

    return { status: API_KEY_STATUS.VALID };
  }
}
