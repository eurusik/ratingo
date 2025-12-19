/**
 * Minimalist bookmark icon for media cards.
 * Self-contained with API integration.
 * Uses SavedStatusProvider context for batch status fetching (no N+1 queries).
 */

'use client';

import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useSaveItem, useUnsaveItem } from '@/core/query';
import { useSavedStatusContext } from '@/core/saved-status';

const DEFAULT_LIST = 'for_later' as const;

/** Map listContext to reasonKey for saved items */
const LIST_CONTEXT_TO_REASON: Record<string, string> = {
  TRENDING_LIST: 'trendingNow',
  NEW_RELEASES_LIST: 'justReleased',
  IN_THEATERS_LIST: 'justReleased',
  NEW_ON_STREAMING_LIST: 'nowStreaming',
  CONTINUE_LIST: 'trendingNow',
  USER_LIBRARY: 'trendingNow',
  DEFAULT: 'trendingNow',
};

interface CardBookmarkProps {
  /** Media item ID for API calls. */
  mediaItemId?: string;
  /** List context from API (TRENDING_LIST, etc.) - used to derive reasonKey. */
  listContext?: string | null;
  /** Manual override: Whether item is bookmarked. */
  isBookmarked?: boolean;
  /** Manual override: Click handler. */
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * Minimalist bookmark icon - appears on hover.
 * If mediaItemId is provided, handles save/unsave automatically.
 * Reads status from SavedStatusProvider context (batch fetched).
 */
export function CardBookmark({ 
  mediaItemId, 
  listContext,
  isBookmarked: isBookmarkedProp, 
  onClick: onClickProp, 
  className 
}: CardBookmarkProps) {
  const { isAuthenticated } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);
  
  // Use context for batch status (no individual API calls)
  const statusContext = useSavedStatusContext();
  const contextStatus = mediaItemId ? statusContext?.getStatus(mediaItemId) : undefined;

  const { mutate: saveItem, isPending: isSaving } = useSaveItem();
  const { mutate: unsaveItem, isPending: isUnsaving } = useUnsaveItem();

  // Priority: prop > context > false
  const isBookmarked = isBookmarkedProp ?? contextStatus?.isForLater ?? false;
  const isMutating = isSaving || isUnsaving;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLButtonElement).blur();

    // If manual onClick provided, use it
    if (onClickProp) {
      onClickProp(e);
      return;
    }

    // Otherwise handle via API
    if (!mediaItemId) return;

    if (!isAuthenticated) {
      openLogin();
      return;
    }

    if (isMutating) return;

    if (isBookmarked) {
      unsaveItem(
        { mediaItemId, list: DEFAULT_LIST, context: 'card' },
        {
          onSuccess: () => {
            toast.success('Видалено зі збережених');
            statusContext?.invalidate();
          },
          onError: () => toast.error('Не вдалося видалити'),
        }
      );
    } else {
      saveItem(
        { 
          mediaItemId, 
          list: DEFAULT_LIST, 
          context: 'card',
          reasonKey: listContext ? LIST_CONTEXT_TO_REASON[listContext] : undefined,
        },
        {
          onSuccess: () => {
            toast.success('Збережено');
            statusContext?.invalidate();
          },
          onError: () => toast.error('Не вдалося зберегти'),
        }
      );
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isMutating}
      className={cn(
        'absolute top-2 left-2 p-2 rounded-lg z-10 cursor-pointer',
        'bg-black/60 backdrop-blur-sm',
        'opacity-0 group-hover:opacity-100',
        'transition-all duration-200',
        'hover:bg-black/80 hover:scale-110',
        'focus:outline-none',
        'disabled:opacity-50',
        className
      )}
      aria-label={isBookmarked ? 'Видалити з закладок' : 'Додати в закладки'}
    >
      <Bookmark
        className={cn(
          'w-5 h-5 transition-colors',
          isBookmarked ? 'fill-blue-400 text-blue-400' : 'text-white'
        )}
      />
    </button>
  );
}
