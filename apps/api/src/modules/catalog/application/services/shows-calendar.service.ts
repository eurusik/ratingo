import { Inject, Injectable } from '@nestjs/common';

import {
  WATCHING_SHOWS_COUNT_PORT,
  type WatchingShowsCountPort,
} from '../../domain/ports/watching-shows-count.port';

/**
 * Application service for show calendar features.
 * Encapsulates calendar-related query logic for the shows catalog.
 */
@Injectable()
export class ShowsCalendarService {
  constructor(
    @Inject(WATCHING_SHOWS_COUNT_PORT)
    private readonly watchingShowsCount: WatchingShowsCountPort,
  ) {}

  /**
   * Returns the number of shows a user is currently watching.
   * Used by the personalized calendar to distinguish between "no watching shows"
   * and "watching shows but none air this week".
   *
   * @param userId - Authenticated user's ID
   * @returns Count of shows the user is currently watching
   */
  getWatchingShowsCount(userId: string): Promise<number> {
    return this.watchingShowsCount.execute(userId);
  }
}
