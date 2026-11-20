import { type ShowPremiereFacts } from '@/modules/shared/show-premiere';

export type { ShowPremiereFacts };

export const SHOW_STATE_PORT = Symbol('SHOW_STATE_PORT');

export interface IShowStatePort {
  getLastAiredEpisodeKey(mediaItemId: string): Promise<string | null>;
  findShowPremiereFacts(mediaItemId: string, asOf: Date): Promise<ShowPremiereFacts | null>;
}
