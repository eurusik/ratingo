import { Injectable } from '@nestjs/common';

import { WatchingShowsCountQuery } from '../../infrastructure/queries/watching-shows-count.query';

/**
 * Application service for show calendar features.
 * Encapsulates calendar-related query logic for the shows catalog.
 */
@Injectable()
export class ShowsCalendarService {
  constructor(private readonly watchingShowsCountQuery: WatchingShowsCountQuery) {}

  /**
   * Returns the number of shows a user is currently watching.
   * Used by the personalized calendar to distinguish between "no watching shows"
   * and "watching shows but none air this week".
   *
   * @param userId - Authenticated user's ID
   * @returns Count of shows the user is currently watching
   */
  getWatchingShowsCount(userId: string): Promise<number> {
    return this.watchingShowsCountQuery.execute(userId);
  }
}
