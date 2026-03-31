import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/core/query/keys';
import { useSaveItem, useUnsaveItem } from '@/core/query';
import { useTranslation } from '@/shared/i18n';
import type { MediaSaveStatusDto, SavedItemList } from '@/core/api';
import type { MeUserMediaListItemDto } from '@/core/api/me-lists.client';

/** States where the user is still actively engaged — don't auto-remove. */
const ACTIVE_STATES = new Set(['watching', 'paused']);

export function useAutoUnsaveOnRating(mediaItemId: string) {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();
  const { mutateAsync: unsaveItem } = useUnsaveItem();
  const { mutateAsync: saveItem } = useSaveItem();

  async function tryAutoUnsave(score: number, emoji: string) {
    // Check user media state (already updated by setRating's onSuccess)
    const userMediaState = queryClient.getQueryData<MeUserMediaListItemDto>(
      queryKeys.userMedia.state(mediaItemId),
    );
    if (userMediaState && ACTIVE_STATES.has(userMediaState.state)) return;

    const saveStatus = queryClient.getQueryData<MediaSaveStatusDto>(
      queryKeys.userActions.savedItems.status(mediaItemId),
    );
    if (!saveStatus) return;

    let list: SavedItemList | null = null;
    if (saveStatus.isForLater) list = 'for_later';
    else if (saveStatus.isConsidering) list = 'considering';
    if (!list) return;

    const savedList = list;

    try {
      await unsaveItem({ mediaItemId, list: savedList, context: 'auto_on_rate' });

      const message = dict.userRating.toast.removedFromSaved
        .replace('{emoji}', emoji)
        .replace('{score}', String(score));

      toast(message, {
        duration: 5000,
        action: {
          label: dict.userRating.toast.undo,
          onClick: () => {
            saveItem({ mediaItemId, list: savedList, context: 'undo_auto_on_rate' });
          },
        },
      });
    } catch {
      // Rating already succeeded — silently skip unsave failure
    }
  }

  return { tryAutoUnsave };
}
