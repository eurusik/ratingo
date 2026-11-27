import { type NormalizedMedia } from './models/normalized-media.model';

export function keepStoredEpisodeSchedule(media: NormalizedMedia): NormalizedMedia {
  if (!media.details) return media;

  const {
    seasons: _seasons,
    totalEpisodes: _totalEpisodes,
    lastAirDate: _lastAirDate,
    nextAirDate: _nextAirDate,
    ...details
  } = media.details;
  return { ...media, details };
}
