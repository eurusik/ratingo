/**
 * Base card layout component - shared markup for MediaCard and MediaCardServer.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/shared/utils';

/** Container styles for card hover effects */
export const cardContainerStyles = [
  'group relative h-full flex flex-col',
  'bg-[#111113] rounded-xl overflow-hidden',
  'transition-all duration-300',
  'hover:shadow-2xl hover:shadow-blue-500/20',
  'border border-zinc-800 hover:border-blue-500/50',
] as const;

/** Title styles */
export const cardTitleStyles = [
  'font-semibold text-white text-base line-clamp-2 mb-2',
  'min-h-[2.5rem] break-words',
  'group-hover:text-blue-400 transition-colors',
] as const;

export interface CardLayoutProps {
  /** Detail page URL */
  href: string;
  /** Use article tag for SSR semantic HTML */
  as?: 'div' | 'article';
  /** Poster slot */
  poster: React.ReactNode;
  /** Overlay slot (buttons outside of Link, e.g. bookmark) */
  overlay?: React.ReactNode;
  /** Content slot */
  children: React.ReactNode;
  className?: string;
}

/**
 * Base card layout with Link wrapper.
 * Overlay slot is rendered outside Link for clickable buttons.
 */
export function CardLayout({ href, as: Tag = 'div', poster, overlay, children, className }: CardLayoutProps) {
  return (
    <Tag className={cn(cardContainerStyles, 'relative', className)}>
      {/* Overlay (buttons) - z-10, outside Link flow */}
      {overlay}

      {/* Link covers the card for navigation */}
      <Link href={href as Route} className="block h-full">
        {/* Poster area */}
        <div className="overflow-hidden">
          {poster}
        </div>

        {/* Content area */}
        <div className="p-3 flex-1 flex flex-col">
          {children}
        </div>
      </Link>
    </Tag>
  );
}
