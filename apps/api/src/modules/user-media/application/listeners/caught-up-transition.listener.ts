import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { SHOW_EVENTS } from '../../../user-actions/public';
import { UserMediaStateChangedEvent } from '../../domain/events/user-media-state-changed.event';
import {
  USER_MEDIA_STATE_REPOSITORY,
  type IUserMediaStateRepository,
} from '../../domain/repositories/user-media-state.repository.interface';

/**
 * Transitions caught_up → watching when a new episode is detected during sync.
 * Uses a single bulk UPDATE instead of N+1 per-user calls.
 */
@Injectable()
export class CaughtUpTransitionListener {
  private readonly logger = new Logger(CaughtUpTransitionListener.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SHOW_EVENTS.NEW_EPISODE)
  async handle(payload: { mediaItemId: string }): Promise<void> {
    let transitioned;

    try {
      transitioned = await this.repo.bulkTransitionCaughtUpToWatching(payload.mediaItemId);
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
