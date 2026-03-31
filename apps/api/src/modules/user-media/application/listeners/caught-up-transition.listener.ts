import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { SHOW_EVENTS } from '../../../user-actions/public';
import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import {
  USER_MEDIA_STATE_REPOSITORY,
  type IUserMediaStateRepository,
} from '../../domain/repositories/user-media-state.repository.interface';
import { UserMediaService } from '../user-media.service';

/**
 * Transitions caught_up → watching when a new episode is detected during sync.
 * Listens to 'show.new-episode' emitted by SubscriptionTriggerService.
 */
@Injectable()
export class CaughtUpTransitionListener {
  private readonly logger = new Logger(CaughtUpTransitionListener.name);

  constructor(
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly userMediaService: UserMediaService,
  ) {}

  @OnEvent(SHOW_EVENTS.NEW_EPISODE)
  async handle(payload: { mediaItemId: string }): Promise<void> {
    let caughtUpUsers: Array<{ userId: string }>;

    try {
      caughtUpUsers = await this.repo.findByMediaAndState(
        payload.mediaItemId,
        USER_MEDIA_STATE.CAUGHT_UP,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to fetch caught_up users for media=${payload.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
      return;
    }

    let transitioned = 0;

    for (const entry of caughtUpUsers) {
      try {
        await this.userMediaService.setState({
          userId: entry.userId,
          mediaItemId: payload.mediaItemId,
          state: USER_MEDIA_STATE.WATCHING,
        });
        transitioned++;
      } catch (error) {
        this.logger.warn(
          `Failed to transition caught_up → watching for user=${entry.userId} media=${payload.mediaItemId}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (transitioned > 0) {
      this.logger.log(
        `Transitioned ${transitioned} users from caught_up to watching for media=${payload.mediaItemId}`,
      );
    }
  }
}
