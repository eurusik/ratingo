import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { ErrorCode } from '../../../../../common/enums/error-code.enum';
import { type MediaType } from '../../../../../common/enums/media-type.enum';
import { ExternalApiException } from '../../../../../common/exceptions';
import {
  ResilientHttpClient,
  type RetryConfig,
} from '../../../../../common/http/resilient-http.client';
import webRevalidationConfig from '../../../../../config/web-revalidation.config';
import { type WebPageCachePort } from '../../../domain/ports/web-page-cache.port';

const REVALIDATE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxTotalTimeMs: 10_000,
  timeoutMs: 5_000,
};

@Injectable()
export class NextRevalidateAdapter implements WebPageCachePort {
  private readonly httpClient = new ResilientHttpClient(REVALIDATE_RETRY_CONFIG);

  constructor(
    @Inject(webRevalidationConfig.KEY)
    private readonly config: ConfigType<typeof webRevalidationConfig>,
  ) {}

  async invalidateMediaPage(type: MediaType, slug: string): Promise<void> {
    const { url, secret } = this.config;
    if (!url || !secret) return;

    const result = await this.httpClient.post(
      url,
      { type, slug },
      { Authorization: `Bearer ${secret}` },
    );

    if (!result.success) {
      throw new ExternalApiException(
        ErrorCode.EXTERNAL_API_ERROR,
        `Web page revalidation failed for ${type} "${slug}": ${result.error?.message ?? 'unknown error'}`,
      );
    }
  }
}
