export const SHOW_STATE_PORT = Symbol('SHOW_STATE_PORT');

export interface ShowPremiereFacts {
  firstAirDate: Date | null;
  status: string | null;
  hasAiredEpisode: boolean;
}

export interface IShowStatePort {
  getLastAiredEpisodeKey(mediaItemId: string): Promise<string | null>;
  findShowPremiereFacts(mediaItemId: string, asOf: Date): Promise<ShowPremiereFacts | null>;
}
