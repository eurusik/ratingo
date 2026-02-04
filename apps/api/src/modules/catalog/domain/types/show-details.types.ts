import type { CardMeta } from '../../../shared/cards/domain/card.types';
import type {
  ShowStatusHint,
  ShowVerdict,
} from '../../../shared/verdict/domain/show-verdict.types';
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
