/**
 * Minimalist bookmark icon for media cards.
 *
 */

'use client';

import { Bookmark } from 'lucide-react';
import { cn } from '@/shared/utils';

interface CardBookmarkProps {
  /** Whether item is bookmarked. */
  isBookmarked?: boolean;
  /** Click handler. */
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * Minimalist bookmark icon - appears on hover.
 *
 */
export function CardBookmark({ isBookmarked = false, onClick, className }: CardBookmarkProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLButtonElement).blur();
        onClick?.(e);
      }}
      className={cn(
        'absolute top-2 left-2 p-2 rounded-lg z-10 cursor-pointer',
        'bg-black/60 backdrop-blur-sm',
        'opacity-0 group-hover:opacity-100',
        'transition-all duration-200',
        'hover:bg-black/80 hover:scale-110',
        'focus:outline-none',
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
