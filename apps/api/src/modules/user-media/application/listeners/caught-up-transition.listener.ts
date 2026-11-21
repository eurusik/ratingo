import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { SHOW_EVENTS } from '@/modules/user-actions/public';
import { UserMediaStateChangedEvent } from '@/modules/user-media/domain/events/user-media-state-changed.event';
import {
  USER_MEDIA_STATE_REPOSITORY,
  type IUserMediaStateRepository,
} from '@/modules/user-media/domain/repositories/user-media-state.repository.interface';

@Injectable()
export class CaughtUpTransitionListener {
  private readonly logger = new Logger(CaughtUpTransitionListener.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  @OnEvent(SHOW_EVENTS.NEW_EPISODE)
  async handle(payload: { mediaItemId: string }): Promise<void> {
    let transitioned;

    try {
      transitioned = await this.repo.bulkTransitionCaughtUpWithUnwatchedAiredEpisode(
        payload.mediaItemId,
        this.clock.now(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to bulk transition caught_up → watching for media=${payload.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
      return;
    }

    if (transitioned.length === 0) return;

    this.logger.log(
      `Transitioned ${transitioned.length} users from caught_up to watching for media=${payload.mediaItemId}`,
    );

    for (const state of transitioned) {
      this.eventEmitter.emit(
        UserMediaStateChangedEvent.eventName,
        new UserMediaStateChangedEvent(state.userId, state.mediaItemId, state.state, 'caught_up'),
      );
    }
  }
}
