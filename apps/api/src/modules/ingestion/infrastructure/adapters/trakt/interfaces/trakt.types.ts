export interface EpisodeData {
  number: number;
  title: string;
  rating: number;
  votes: number;
}

export interface SeasonData {
  number: number;
  episodes: EpisodeData[];
}
