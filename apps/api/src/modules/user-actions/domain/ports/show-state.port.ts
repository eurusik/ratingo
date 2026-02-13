export const SHOW_STATE_PORT = Symbol('SHOW_STATE_PORT');

export interface IShowStatePort {
  getLastAiredEpisodeKey(mediaItemId: string): Promise<string | null>;
}
