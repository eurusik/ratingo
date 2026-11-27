export interface EpisodeDetailsBackfillCandidate {
  showId: string;
  tmdbId: number;
}

export interface EpisodeTitleRepairCandidate extends EpisodeDetailsBackfillCandidate {
  imdbId: string;
}

export interface EpisodeDetailsCandidatePage {
  cursor?: string;
  limit: number;
  asOf: Date;
  checkedBefore: Date;
}

export interface EpisodeDetails {
  title: string | null;
  overview: string | null;
  airDate: Date | null;
  runtime: number | null;
  stillPath: string | null;
  rating: number | null;
}

export interface StoredEpisode extends EpisodeDetails {
  id: string;
  seasonNumber: number;
  number: number;
}

export interface EpisodeDetailsUpdate {
  id: string;
  next: EpisodeDetails;
  previous: EpisodeDetails;
}
