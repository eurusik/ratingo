import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  EXTERNAL_API_FAILURE_EVENT,
  type ExternalApiFailureEvent,
} from '@/common/events/external-api-failure.event';

import { KeyHealthService } from '../services/key-health.service';

@Injectable()
export class ExternalApiFailureListener {
  constructor(private readonly keyHealthService: KeyHealthService) {}

  @OnEvent(EXTERNAL_API_FAILURE_EVENT)
  async handle(event: ExternalApiFailureEvent): Promise<void> {
    await this.keyHealthService.recordFailure(event.provider, event.statusCode);
  }
}
