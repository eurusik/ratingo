import type { CardMeta } from '@/modules/shared/cards';
import type { ShowStatusHint, ShowVerdict } from '@/modules/shared/verdict';

import type { UserState } from '../ports/user-state-provider.port';
import type { ShowDetails } from '../repositories/show.repository.interface';

/**
 * Enriched show details with user state, card metadata, and verdict.
 * This is the result type for show details queries.
 */
export interface EnrichedShowDetails extends ShowDetails {
  userState: UserState | null;
  card: CardMeta | null;
  verdict: ShowVerdict;
  statusHint: ShowStatusHint | null;
}
