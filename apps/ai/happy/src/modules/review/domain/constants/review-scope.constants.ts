import { FullReviewReason } from '../entities/review-scope';
import { FindingStatus } from '../entities/tracked-finding';

export const FULL_REASON_TEXT: Readonly<Record<FullReviewReason, string>> = {
  [FullReviewReason.NO_PREVIOUS]:
    'попереднього рев’ю цього PR не знайдено: це перше або історію гілки переписано',
  [FullReviewReason.REQUESTED]: 'повне рев’ю запросили явно',
  [FullReviewReason.HISTORY_REWRITTEN]:
    'історію гілки переписано (rebase або force-push), нові коміти не порівняти з минулим рев’ю',
  [FullReviewReason.COMPARE_FAILED]: 'GitHub не віддав порівняння з минулим рев’ю',
  [FullReviewReason.PREVIOUS_UNREADABLE]: 'стан минулого рев’ю не вдалося прочитати',
  [FullReviewReason.PREVIOUS_INCOMPLETE]: 'минуле рев’ю було неповним',
};

export const STATUS_EMOJI: Readonly<Record<FindingStatus, string>> = {
  [FindingStatus.NEW]: '🆕',
  [FindingStatus.STILL_OPEN]: '⚠️',
  [FindingStatus.RESOLVED]: '✅',
  [FindingStatus.NEEDS_RECHECK]: '❓',
};
