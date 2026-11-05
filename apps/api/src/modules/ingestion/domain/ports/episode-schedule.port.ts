import { type NormalizedEpisode } from '../models/normalized-media.model';

export interface ScheduledEpisode extends NormalizedEpisode {
  seasonNumber: number;
}

export interface EpisodeSchedulePort {
  getEpisodesByImdbId(imdbId: string): Promise<ScheduledEpisode[]>;
  getEpisodesByShowName(showName: string): Promise<ScheduledEpisode[]>;
}

export const EPISODE_SCHEDULE_PORT = Symbol('EPISODE_SCHEDULE_PORT');
