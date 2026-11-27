export class EpisodeScheduleUnavailableError extends Error {
  readonly code = 'EPISODE_SCHEDULE_UNAVAILABLE';

  constructor(
    readonly statusCode: number,
    reason: string,
  ) {
    super(`Episode schedule unavailable (${statusCode}): ${reason}`);
    this.name = 'EpisodeScheduleUnavailableError';
  }
}
