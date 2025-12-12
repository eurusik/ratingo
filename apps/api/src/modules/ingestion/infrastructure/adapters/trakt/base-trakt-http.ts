import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import traktConfig from '../../../../../config/trakt.config';
import { TraktApiException } from '../../../../../common/exceptions/external-api.exception';

@Injectable()
export class BaseTraktHttp {
  protected readonly logger = new Logger(BaseTraktHttp.name);

  constructor(
    @Inject(traktConfig.KEY)
    private readonly config: ConfigType<typeof traktConfig>,
  ) {
    if (!this.config.clientId) {
      throw new TraktApiException('Client ID is not configured');
    }
  }

  /**
   * Generic fetch wrapper with automatic rate limit handling.
   *
   * @param endpoint - API endpoint starting with slash (e.g., '/shows/trending')
   * @param options - Standard fetch options
   * @returns Parsed JSON response
   * @throws TraktApiException if response is not OK and not retriable
   */
  protected async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId!,
      'User-Agent': this.config.userAgent,
      ...options.headers,
    };

    const makeReq = async () =>
      fetch(url, {
        ...options,
        headers,
      });

    let response = await makeReq();

    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const ms = Math.max(0, Math.round((parseFloat(String(ra || '10')) || 10) * 1000));
      this.logger.warn(`Rate limited. Waiting ${ms}ms...`);
      await new Promise((r) => setTimeout(r, ms));
      response = await makeReq();
    }

    if (!response.ok) {
      throw new TraktApiException(`${response.status} ${response.statusText}`, response.status);
    }

    return response.json();
  }
}
