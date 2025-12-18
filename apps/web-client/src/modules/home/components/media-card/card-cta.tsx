/**
 * Minimalist bookmark icon for media cards.
 * Self-contained with API integration.
 */

'use client';

import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useSaveStatus, useSaveItem, useUnsaveItem } from '@/core/query';

const DEFAULT_LIST = 'for_later' as const;

interface CardBookmarkProps {
  /** Media item ID for API calls. */
  mediaItemId?: string;
  /** Verdict key for reasonKey when saving. */
  verdictKey?: string | null;
  /** Manual override: Whether item is bookmarked. */
  isBookmarked?: boolean;
  /** Manual override: Click handler. */
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * Minimalist bookmark icon - appears on hover.
 * If mediaItemId is provided, handles save/unsave automatically.
 */
export function CardBookmark({ 
  mediaItemId, 
  verdictKey,
  isBookmarked: isBookmarkedProp, 
  onClick: onClickProp, 
  className 
}: CardBookmarkProps) {
  const { isAuthenticated } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const { data: saveStatus } = useSaveStatus(mediaItemId ?? '', {
    enabled: isAuthenticated && !!mediaItemId,
  });

  const { mutate: saveItem, isPending: isSaving } = useSaveItem();
  const { mutate: unsaveItem, isPending: isUnsaving } = useUnsaveItem();

  // Use prop if provided, otherwise use API status
  const isBookmarked = isBookmarkedProp ?? saveStatus?.isForLater ?? false;
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
          onSuccess: () => toast.success('Видалено зі збережених'),
          onError: () => toast.error('Не вдалося видалити'),
        }
      );
    } else {
      saveItem(
        { 
          mediaItemId, 
          list: DEFAULT_LIST, 
          context: 'card',
          reasonKey: verdictKey ?? undefined,
        },
        {
          onSuccess: () => toast.success('Збережено'),
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
