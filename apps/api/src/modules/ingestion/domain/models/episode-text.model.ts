export interface EpisodeTextsBackfillCandidate {
  showId: string;
  tmdbId: number;
}

export interface StoredEpisodeText {
  id: string;
  seasonNumber: number;
  number: number;
  title: string | null;
  overview: string | null;
}

export interface EpisodeTextUpdate {
  id: string;
  title: string | null;
  overview: string | null;
  previousTitle: string | null;
  previousOverview: string | null;
}
