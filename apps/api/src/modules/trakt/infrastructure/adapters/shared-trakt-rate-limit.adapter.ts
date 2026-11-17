import { Injectable } from '@nestjs/common';

import { type TraktRateLimitPort } from '@/modules/trakt/domain/ports/trakt-rate-limit.port';

import { acquireTraktRateLimitToken } from './base-trakt-http';

@Injectable()
export class SharedTraktRateLimitAdapter implements TraktRateLimitPort {
  acquire(): Promise<void> {
    return acquireTraktRateLimitToken();
  }
}
